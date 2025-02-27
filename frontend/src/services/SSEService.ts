import { StreamingSource } from "@/types/api.types.ts";

class SSEService {
  private static instance: SSEService;
  private eventSource: EventSource | null = null;
  private source: StreamingSource = "chrome-puppeteer";
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private reconnectTimeout: number = 3000;

  private constructor() {}

  static getInstance(): SSEService {
    if (!SSEService.instance) {
      SSEService.instance = new SSEService();
    }
    return SSEService.instance;
  }

  setSource(source: StreamingSource) {
    this.source = source;
    return this;
  }

  getSource(): StreamingSource {
    return this.source;
  }

  connect(url?: string): EventSource {
    if (this.eventSource) {
      return this.eventSource;
    }

    const endpoint =
      url || `http://localhost:3000/browser/screenstream?source=${this.source}`;

    this.eventSource = new EventSource(endpoint);

    // Listen for incoming messages.
    this.eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        window.dispatchEvent(
          new CustomEvent("screen-stream", { detail: data.screenShot }),
        );
      } catch (error) {
        console.error("Error parsing SSE data:", error);
      }
    };

    // Reset reconnection attempts when connection is opened.
    this.eventSource.onopen = () => {
      this.reconnectAttempts = 0;
      window.dispatchEvent(
        new CustomEvent("browser-console", {
          detail: {
            type: "info",
            message: "Screen streaming connected",
          },
        }),
      );
    };

    // Handle errors and attempt reconnection using exponential backoff.
    this.eventSource.onerror = (error) => {
      window.dispatchEvent(
        new CustomEvent("browser-console", {
          detail: {
            type: "error",
            message: `SSE connection error: ${error}`,
          },
        }),
      );

      this.disconnect();

      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        this.reconnectAttempts++;
        const timeout =
          this.reconnectTimeout * Math.pow(2, this.reconnectAttempts - 1);
        setTimeout(() => {
          window.dispatchEvent(
            new CustomEvent("browser-console", {
              detail: {
                type: "info",
                message: `Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`,
              },
            }),
          );
          this.connect(endpoint);
        }, timeout);
      }
    };

    return this.eventSource;
  }

  disconnect() {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
      window.dispatchEvent(
        new CustomEvent("browser-console", {
          detail: {
            type: "info",
            message: "Screen streaming disconnected",
          },
        }),
      );
    }
  }

  isConnected(): boolean {
    return (
      this.eventSource !== null &&
      this.eventSource.readyState === EventSource.OPEN
    );
  }
}

export default SSEService;
