export interface ApiResponse<T> {
  status?: string;
  message?: string;
  data?: T;
}

export type StreamingSource = 'chrome-puppeteer' | 'ubuntu-docker-vnc';

export interface HealthCheckResponse {
  status: string;
  message: string;
}

export interface ChatMessage {
  message: string;
  timestamp?: number;
}

export interface ChatResponse {
  message: string;
  timestamp: number;
}

export interface Action {
  actionType: string;
  url?: string;
  coordinate?: string;
  text?: string;
  key?: string;
}
