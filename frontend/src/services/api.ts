import {
  ActionResult,
  ChatMessage,
  OmniParserResult,
} from "../types/chat.types";
import { Action, StreamingSource } from "../types/api.types";
import { MessageProcessor } from "./messageProcessor";

const API_BASE_URL = "http://localhost:3000/";

export const checkHealth = async () => {
  const response = await fetch(`${API_BASE_URL}/health`);
  return response.json();
};

/**
 * Invokes the LLM task endpoint and returns a simple JSON response.
 * Now the endpoint (/browser/task) returns a full JSON object instead of a stream.
 */
export const sendChatMessage = async (
  message: string,
  imageData: string | undefined,
  history: ChatMessage[],
  folderPath: string,
  currentChatId: string,
  source: "chrome-puppeteer" | "ubuntu-docker-vnc",
  onChunk: (chunk: string) => void,
  onComplete: () => void,
  onError: (error: Error) => void,
  omniParserResult?: OmniParserResult | null,
  saveScreenshots: boolean = false,
): Promise<() => void> => {
  try {
    const queryParams = new URLSearchParams({
      folderPath,
      currentChatId,
      source,
      saveScreenshots: saveScreenshots.toString(),
    });

    const response = await fetch(`${API_BASE_URL}browser/task?${queryParams}`, {
      method: "POST",
      headers: {
        provider: "anthropic",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        task: MessageProcessor.parseActionResult(message),
        imageData,
        // Sanitize history before sending to backend
        history: history.map((msg) => {
          if (msg.isUser) {
            return { text: msg.text, isUser: true };
          }
          // If this is an action result, convert it to plain text feedback
          if (msg.text.includes("<perform_action_result>")) {
            const text = MessageProcessor.parseActionResult(msg.text);
            if (text) {
              return { text, isUser: true };
            }
          }
          return { text: msg.text, isUser: false };
        }),
        omniParserResult: omniParserResult || undefined,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP error ${response.status}: ${errorText}`);
    }

    const result = await response.json();
    // Call onChunk with the action response if available.
    if (result.action) {
      onChunk(result.action);
    }
    onComplete();
  } catch (error) {
    onError(error instanceof Error ? error : new Error(String(error)));
  }

  // Return a no-op cleanup function.
  return () => {};
};

export const getFileStructure = async (path: string) => {
  const response = await fetch(
    `${API_BASE_URL}/filesystem/structure?path=${encodeURIComponent(path)}`,
  );
  return response.json();
};

export const executeAction = async (
  action: Action,
  source: StreamingSource,
): Promise<ActionResult> => {
  const response = await fetch(
    `${API_BASE_URL}browser/action?source=${source}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(action),
    },
  );

  const result = await response.json();
  if (!response.ok) {
    throw new Error(
      result.error || `Action execution failed: ${response.statusText}`,
    );
  }
  return result;
};

/**
 * Invokes the explore message endpoint.
 * Like sendChatMessage, it now awaits a full JSON response.
 */
export const sendExploreChatMessage = async (
  message: string,
  imageData: string | undefined,
  history: ChatMessage[],
  type: string,
  folderPath: string,
  currentChatId: string,
  source: "chrome-puppeteer" | "ubuntu-docker-vnc",
  onChunk: (chunk: string) => void,
  onComplete: (image?: string) => void,
  onError: (error: Error) => void,
  omniParserResult?: OmniParserResult | null,
  saveScreenshots: boolean = false,
): Promise<() => void> => {
  try {
    const queryParams = new URLSearchParams({
      folderPath,
      currentChatId,
      source,
      type,
      saveScreenshots: saveScreenshots.toString(),
    });

    const response = await fetch(
      `${API_BASE_URL}/explore/message?${queryParams}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: MessageProcessor.parseActionResult(message),
          imageData,
          // Sanitize history before sending to backend
          history: history.map((msg) => {
            if (msg.isUser) {
              return { text: msg.text, isUser: true };
            }
            if (msg.text.includes("<perform_action_result>")) {
              const text = MessageProcessor.parseActionResult(msg.text);
              if (text) {
                return { text, isUser: true };
              }
            }
            return { text: msg.text, isUser: false };
          }),
          omniParserResult: omniParserResult || undefined,
        }),
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP error ${response.status}: ${errorText}`);
    }

    const result = await response.json();
    // If the response contains an action message, pass it via onChunk.
    if (result.action) {
      onChunk(result.action);
    }
    // If there's image data returned (for example, a screenshot), pass it to onComplete.
    onComplete(result.imageData);
  } catch (error) {
    onError(error instanceof Error ? error : new Error(String(error)));
  }

  return () => {};
};

export const getCurrentUrl = async (
  source: StreamingSource,
): Promise<string | null> => {
  try {
    const response = await fetch(
      `${API_BASE_URL}/explore/current-path?source=${source}`,
    );
    const data: { url: string } = await response.json();
    return data.url;
  } catch (e) {
    return null;
  }
};
