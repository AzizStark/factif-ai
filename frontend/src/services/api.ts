import { ActionResult, ChatMessage, OmniParserResult } from '../types/chat.types';
import { Action, StreamingSource } from '../types/api.types';
import { MessageProcessor } from './messageProcessor';

const API_BASE_URL = '/api';

export const checkHealth = async () => {
  const response = await fetch(`${API_BASE_URL}/health`);
  return response.json();
};

export const sendChatMessage = async (
  message: string,
  imageData: string | undefined,
  history: ChatMessage[],
  folderPath: string,
  currentChatId: string,
  source: 'chrome-puppeteer' | 'ubuntu-docker-vnc',
  onChunk: (chunk: string) => void,
  onComplete: () => void,
  onError: (error: Error) => void,
  omniParserResult?: OmniParserResult | null,
  saveScreenshots: boolean = false,
): Promise<() => void> => {  
  let hasReceivedMessage = false;

  // Create a URLSearchParams object for the query parameters
  const queryParams = new URLSearchParams({
    folderPath,
    currentChatId,
    source,
    saveScreenshots: saveScreenshots.toString(),
  });

  // Create the EventSource with POST method using a fetch API
  const response = await fetch(`${API_BASE_URL}/chat?${queryParams}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: MessageProcessor.parseActionResult(message),
      imageData,
      // Sanitize history before sending to backend
      history: history.map(msg => {
        if (msg.isUser) {
          return { text: msg.text, isUser: true };
        }
        
        // If this is an action result, convert it to plain text feedback
        if (msg.text.includes('<perform_action_result>')) {
          const text = MessageProcessor.parseActionResult(msg.text);
          if (text) {
            return {
              text,
              isUser: true // Mark as user message for LLM context
            };
          }
        }
        
        return { text: msg.text, isUser: false };
      }),
      omniParserResult: omniParserResult || undefined,
    }),
  });

  if (!response.body) {
    throw new Error('No response body received');
  }

  let reader: ReadableStreamDefaultReader<Uint8Array>;
  const decoder = new TextDecoder();
  let connectionTimeout = 0;

  try {
    reader = response.body.getReader();

    // Set up connection timeout
    connectionTimeout = setTimeout(() => {
      if (!hasReceivedMessage) {
        console.error('Connection timeout');
        reader?.cancel();
        onError(new Error('Connection timeout - no response received'));
      }
    }, 60 * 1000); // 60 second timeout
    // Process the stream
    const processStream = async () => {
      try {
        while (true) {
          const { done, value } = await reader.read();
          
          if (done) {
            onComplete();
            break;
          }

          hasReceivedMessage = true;
          clearTimeout(connectionTimeout);

          const chunk = decoder.decode(value);
          const lines = chunk.split('\n').filter(line => line.trim());
          
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = JSON.parse(line.slice(6));
              if (data.isComplete) {
                onComplete();
                return;
              } else if (data.isError) {
                onError(new Error(data.message));
                return;
              } else if (data.message) {
                onChunk(data.message);
              }
            }
          }
        }
      } catch (error) {
        clearTimeout(connectionTimeout);
        console.error('Stream processing error:', error);
        onError(error instanceof Error ? error : new Error(String(error)));
      }
    };

    processStream();
  } catch (error) {
    clearTimeout(connectionTimeout);
    throw error instanceof Error ? error : new Error(String(error));
  }

  const cleanup = () => {
    if (connectionTimeout) {
      clearTimeout(connectionTimeout);
    }
    reader?.cancel();
  };

  return cleanup;
};

export const getFileStructure = async (path: string) => {
  const response = await fetch(`${API_BASE_URL}/filesystem/structure?path=${encodeURIComponent(path)}`);
  return response.json();
};

export const executeAction = async (action: Action, source: StreamingSource): Promise<ActionResult> => {
  const response = await fetch(`${API_BASE_URL}/actions/execute?source=${source}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(action),
  });

  const result = await response.json();
  if (!response.ok) {
    throw new Error(result.error || `Action execution failed: ${response.statusText}`);
  }
  return result;
};
