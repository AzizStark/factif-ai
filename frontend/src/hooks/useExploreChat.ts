import { useEffect, useRef, useState } from "react";
import { getCurrentUrl, sendExploreChatMessage } from "../services/api";
import { ChatMessage, OmniParserResult } from "../types/chat.types";
import { useAppContext } from "../contexts/AppContext";
import { MessageProcessor } from "../services/messageProcessor";
import {
  IExploredClickableElement,
  IExploreGraphData,
  IExploreQueueItem,
} from "@/types/message.types.ts";
import { v4 as uuid } from "uuid";
import { useExploreModeContext } from "@/contexts/ExploreModeContext.tsx";
import { createEdgeOrNode } from "@/utils/graph.util.ts";
import { StreamingSource } from "@/types/api.types.ts";

// Interface for screenshot data structure
interface IProcessedScreenshot {
  image: string;
  inference?: any[];
  totalScroll?: number;
  scrollPosition?: number;
  originalImage?: string;
}

export const useExploreChat = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [latestOmniParserResult, setLatestOmniParserResult] =
    useState<OmniParserResult | null>(null);

  const {
    isChatStreaming,
    setIsChatStreaming,
    setHasActiveAction,
    folderPath,
    currentChatId,
    streamingSource,
    saveScreenshots,
    setType,
  } = useAppContext();

  const { setGraphData } = useExploreModeContext();

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const hasPartialMessage = useRef(false);
  const activeMessageId = useRef<string | null>(null);
  const isProcessing = useRef(false);
  const messagesRef = useRef<ChatMessage[]>([]);
  const exploreQueue = useRef<{ [key in string]: IExploreQueueItem[] }>({});
  const exploreRoute = useRef<string[]>([]);
  const exploreGraphData = useRef<IExploreGraphData>({
    nodes: [],
    edges: [],
  });
  const currentlyExploring = useRef<{
    url: string;
    id: string;
    nodeId: string;
    label: string;
  } | null>(null);

  // Initialize MessageProcessor
  useEffect(() => {
    MessageProcessor.initialize(setHasActiveAction);
  }, [setHasActiveAction]);

  // Keep messagesRef in sync with messages state
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // Reset streaming state only on unmount
  useEffect(() => {
    return () => {
      hasPartialMessage.current = false;
      activeMessageId.current = null;
      setIsChatStreaming(false);
    };
  }, [setIsChatStreaming]);

  // Scroll management
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Message management functions
  const addMessage = (newMessage: ChatMessage) => {
    setMessages((prev) => {
      const messageExists = prev.some(
        (msg) =>
          msg.text === newMessage.text &&
          msg.isUser === newMessage.isUser &&
          msg.timestamp.getTime() === newMessage.timestamp.getTime(),
      );
      if (messageExists) return prev;
      return [...prev, newMessage];
    });
  };

  const updateLastMessage = (
    updater: (message: ChatMessage) => ChatMessage,
  ) => {
    setMessages((prev) => {
      if (prev.length === 0) return prev;
      const newMessages = [...prev];
      const lastMessage = newMessages[newMessages.length - 1];
      const updatedMessage = updater(lastMessage);

      if (JSON.stringify(lastMessage) === JSON.stringify(updatedMessage)) {
        return prev;
      }

      newMessages[newMessages.length - 1] = updatedMessage;
      return newMessages;
    });
  };

  // Error handling
  const handleError = (messageId: string, error: Error) => {
    console.error("Explore Chat Error:", error);
    if (activeMessageId.current === messageId) {
      setIsChatStreaming(false);
      hasPartialMessage.current = false;
      activeMessageId.current = null;
      isProcessing.current = false;

      if (messagesRef.current.some((m) => m.isPartial)) {
        updateLastMessage((msg) => ({ ...msg, isPartial: false }));
      }

      addMessage({
        text: "Sorry, there was an error processing your message.",
        timestamp: new Date(),
        isUser: false,
        isHistory: false,
      });
    }
  };

  const createConstructNode = (
    currentNodeId: string,
    data: { label: string; imageData?: string | IProcessedScreenshot },
  ) => {
    const currentNodelCount = exploreGraphData.current.nodes.length;

    // Process image data based on type
    let processedImageData;
    if (data.imageData) {
      if (typeof data.imageData === "string") {
        // If it's already a string, make sure it has the data URI prefix
        processedImageData = data.imageData.startsWith("data:")
          ? data.imageData
          : `data:image/png;base64,${data.imageData}`;
      } else if (typeof data.imageData === "object" && data.imageData.image) {
        // If it's a screenshot object, extract the base64 image
        processedImageData = `${data.imageData.image}`;
      }
    }

    exploreGraphData.current.nodes.push({
      id: currentNodeId,
      position: { x: 200, y: currentNodelCount * 100 },
      data: {
        label: data.label,
        edges: [],
        imageData: processedImageData,
      },
      type: "pageNode",
    });
    setGraphData(exploreGraphData.current);
    localStorage.setItem("MAP", JSON.stringify(exploreGraphData.current));
  };

  const createEdge = (
    sourceId: string,
    targetId: string,
    edgeId: string,
    label: string,
  ) => {
    exploreGraphData.current.edges.push({
      id: edgeId,
      source: sourceId,
      target: targetId,
      sourceHandle: edgeId,
      type: "bezier",
      label,
    });
    exploreGraphData.current.nodes.map((node) => {
      if (node.id === sourceId) {
        node.data.edges = [...node.data.edges, edgeId];
      }
    });
    setGraphData(exploreGraphData.current);
    localStorage.setItem("MAP", JSON.stringify(exploreGraphData.current));
  };

  const handleEdgeAndNodeCreation = (
    url: string,
    imageData?: string | IProcessedScreenshot,
  ) => {
    const canCreateNode = createEdgeOrNode(exploreGraphData.current.nodes, url);
    const nodeId = !canCreateNode.createNode
      ? (canCreateNode.node?.id as string)
      : uuid();

    // Check if this might be the first node (homepage)
    const isFirstNode = exploreGraphData.current.nodes.length === 0;

    if (canCreateNode.createNode) {
      // Log for debugging first node issue
      if (isFirstNode) {
        console.log("Creating first node (homepage):", {
          url,
          hasImageData: !!imageData,
          imageDataType: imageData ? typeof imageData : "undefined",
        });
      }

      createConstructNode(nodeId, { label: url, imageData });
    } else if (
      isFirstNode &&
      !canCreateNode.node?.data.imageData &&
      imageData
    ) {
      // Special case: If we're not creating a new node because it already exists,
      // but it's the first node and doesn't have image data, update it with the image
      console.log("Updating first node with missing image data");
      exploreGraphData.current.nodes = exploreGraphData.current.nodes.map(
        (node) => {
          if (node.id === nodeId) {
            let processedImageData;
            if (typeof imageData === "string") {
              processedImageData = imageData.startsWith("data:")
                ? imageData
                : `data:image/png;base64,${imageData}`;
            } else if (typeof imageData === "object" && imageData.image) {
              processedImageData = `data:image/png;base64,${imageData.image}`;
            }

            return {
              ...node,
              data: {
                ...node.data,
                imageData: processedImageData,
              },
            };
          }
          return node;
        },
      );
      setGraphData(exploreGraphData.current);
    }

    if (currentlyExploring.current) {
      createEdge(
        currentlyExploring.current.nodeId,
        nodeId,
        currentlyExploring.current.id,
        currentlyExploring.current.label,
      );
    }
    return nodeId;
  };

  const handleQueueUpdate = (
    processedExploreMessage: IExploredClickableElement[],
    fullResponse: string,
    url: string,
    nodeId: string,
    parent: {
      url: string;
      id: string;
      nodeId: string;
    } | null,
  ) => {
    for (const element of processedExploreMessage) {
      if (element.text && element.coordinates) {
        const elementId = uuid();
        const exploredOutput: IExploreQueueItem = {
          text: element.text,
          coordinates: element.coordinates,
          aboutThisElement: element.aboutThisElement || "",
          source: fullResponse,
          url,
          id: elementId,
          nodeId,
          parent: {
            url: (parent?.url as string) || url,
            nodeId: (parent?.nodeId as string) || nodeId,
            id: (parent?.id as string) || elementId,
          },
        };
        exploreQueue.current[url].push(exploredOutput);
      }
    }
    localStorage.setItem(
      "started_explore",
      JSON.stringify(exploreQueue.current),
    );
  };

  const cleanCompletedQueue = (
    exploredRoutes: string[],
    currentQueue: { [key in string]: IExploreQueueItem[] },
  ): Set<string> => {
    const routeSet = new Set(exploredRoutes);
    console.log(currentQueue);
    // Object.keys(currentQueue)
    //   .filter((key) => currentQueue[key].length === 0)
    //   .forEach((key) => {
    //     routeSet.delete(key);
    //   });
    return routeSet;
  };

  // Process explore output
  const processExploreOutput = async (
    fullResponse: string,
    parent: { url: string; id: string; nodeId: string } | null = null,
    streamingSource: StreamingSource,
    imageData?: string | IProcessedScreenshot,
  ) => {
    const processedExploreMessage =
      MessageProcessor.processExploreMessage(fullResponse) || [];
    const routeSet = cleanCompletedQueue(
      exploreRoute.current,
      exploreQueue.current,
    );

    if (processedExploreMessage.length > 0) {
      const url = await getCurrentUrl(streamingSource);

      if (!url) return;
      if (!routeSet.has(url as string)) {
        // if (routeSet.size > 0 && checkTheNewRouteIsFromSameDomain(url, routeSet.keys().next().value as string)){
        //   return;
        // }
        routeSet.add(url as string);
        exploreQueue.current[url] = [];
        const nodeId = handleEdgeAndNodeCreation(url, imageData);
        handleQueueUpdate(
          processedExploreMessage,
          fullResponse,
          url,
          nodeId,
          parent,
        );
      }
    }

    exploreRoute.current = [...routeSet];
    return processedExploreMessage.length > 0
      ? processedExploreMessage[0]
      : null;
  };

  const getNextToExplore = () => {
    const route =
      exploreRoute.current.length > 0 ? exploreRoute.current[0] : null;
    console.log("route ===>", route);
    console.log("route ===>", exploreRoute.current);
    console.log("route ===>", exploreQueue.current);
    const nextItem = route ? exploreQueue.current[route].shift() : null;
    if (route && nextItem) {
      currentlyExploring.current = {
        url: route,
        id: nextItem.id,
        nodeId: nextItem.nodeId,
        label: nextItem.text,
      };
    }
    return nextItem;
  };

  // Handle message completion
  const handleMessageCompletion = async (
    messageId: string,
    fullResponse: string,
    imageData?: string | IProcessedScreenshot,
    _omniParserResult?: OmniParserResult,
  ) => {
    if (activeMessageId.current !== messageId) return;

    hasPartialMessage.current = false;
    updateLastMessage((msg) => ({ ...msg, isPartial: false }));

    const processedResponse = await MessageProcessor.processMessage(
      fullResponse,
      streamingSource,
    );

    const exploredOutput = await processExploreOutput(
      fullResponse,
      currentlyExploring.current,
      streamingSource,
      imageData,
    );

    if (
      processedResponse.actionResult ||
      fullResponse.includes("<complete_task>")
    ) {
      if (processedResponse.omniParserResult) {
        setLatestOmniParserResult(processedResponse.omniParserResult);
      }

      updateLastMessage((msg) => ({
        ...msg,
        isPartial: false,
        isHistory: true,
      }));

      processedResponse.actionResult &&
        addMessage({
          text: processedResponse.actionResult,
          timestamp: new Date(),
          isUser: false,
          isHistory: false,
        });

      isProcessing.current = false;

      if (fullResponse.includes("<complete_task>")) {
        setType("explore");
      }

      await handleExploreMessage(
        processedResponse.actionResult
          ? processedResponse.actionResult
          : processedResponse.text,
        fullResponse.includes("<complete_task>") ? "explore" : "action",
        imageData,
        processedResponse.omniParserResult,
      );
    } else if (exploredOutput) {
      await onGettingExploredMode(imageData);
    } else {
      updateLastMessage((msg) => ({
        ...msg,
        isPartial: false,
        isHistory: true,
      }));
      setIsChatStreaming(false);
      activeMessageId.current = null;
      isProcessing.current = false;
    }
  };

  const onGettingExploredMode = async (
    imageData?: string | IProcessedScreenshot,
  ) => {
    const nextElementToVisit = getNextToExplore();
    console.log("nextElementToVisit ===>", nextElementToVisit);
    isProcessing.current = false;
    setType("action");
    setMessages([]);
    if (nextElementToVisit) {
      const message = `In ${nextElementToVisit.url} \n Visit ${nextElementToVisit.text} on coordinate : ${nextElementToVisit.coordinates} with about this element : ${nextElementToVisit.aboutThisElement}. You can decide what to do prior to it.`;
      addMessage({
        text: message,
        timestamp: new Date(),
        isUser: true,
        isHistory: false,
      });
      await handleExploreMessage(message, "action", imageData, undefined);
    } else {
      setIsChatStreaming(false);
    }
  };

  // Handle message chunks
  const handleMessageChunk = (
    messageId: string,
    chunk: string,
    fullResponse: string,
  ) => {
    if (!chunk.trim() || activeMessageId.current !== messageId) return;

    if (!hasPartialMessage.current && activeMessageId.current === messageId) {
      hasPartialMessage.current = true;
      addMessage({
        text: fullResponse,
        timestamp: new Date(),
        isUser: false,
        isPartial: true,
        isHistory: false,
      });
    } else {
      updateLastMessage((msg) => ({
        ...msg,
        text: fullResponse,
      }));
    }
  };

  // Main message handling function
  const handleExploreMessage = async (
    currentMessage: string,
    type: string,
    imageData?: string | IProcessedScreenshot,
    omniParserResult?: OmniParserResult,
  ) => {
    if (isProcessing.current) return;
    isProcessing.current = true;

    const messageId = `msg_${Date.now()}`;
    activeMessageId.current = messageId;
    setIsChatStreaming(true);

    let fullResponse = "";

    try {
      // Convert imageData to string if it's an IProcessedScreenshot object
      let processedImageData: string | undefined;
      if (imageData) {
        if (typeof imageData === "string") {
          processedImageData = imageData;
        } else if (imageData.image) {
          processedImageData = imageData.image;
        }
      }

      await sendExploreChatMessage(
        currentMessage,
        processedImageData,
        messagesRef.current.filter((msg) => !msg.isPartial),
        type,
        folderPath,
        currentChatId,
        streamingSource,
        (chunk: string) => {
          fullResponse += chunk;
          handleMessageChunk(messageId, chunk, fullResponse);
        },
        (image?: string) =>
          handleMessageCompletion(
            messageId,
            fullResponse,
            image,
            omniParserResult,
          ),
        (error: Error) => handleError(messageId, error),
        omniParserResult || latestOmniParserResult,
        saveScreenshots,
      );
    } catch (error) {
      handleError(messageId, error as Error);
    }
  };

  // Public interface functions
  const sendMessage = async (
    message: string,
    sendToBackend: boolean = true,
    type: string,
    imageData?: string,
  ) => {
    if (!message.trim() || isChatStreaming) return;

    addMessage({
      text: message,
      timestamp: new Date(),
      isUser: true,
      isHistory: true,
    });

    if (sendToBackend) {
      await handleExploreMessage(message, type, imageData, undefined);
      setLatestOmniParserResult(null);
    }
  };

  const clearChat = () => {
    if (!isChatStreaming) {
      hasPartialMessage.current = false;
      activeMessageId.current = null;
      isProcessing.current = false;
      messagesRef.current = [];
      setMessages([]);
    }
  };

  const stopStreaming = () => {
    if (isChatStreaming) {
      activeMessageId.current = null;
      hasPartialMessage.current = false;
      isProcessing.current = false;
      setIsChatStreaming(false);

      if (messagesRef.current.some((m) => m.isPartial)) {
        updateLastMessage((msg) => ({
          ...msg,
          isPartial: false,
          isHistory: true,
        }));
      }
    }
  };

  return {
    messages,
    sendMessage,
    clearChat,
    messagesEndRef,
    stopStreaming,
    latestOmniParserResult,
  };
};
