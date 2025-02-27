import { useState, useEffect, useRef } from 'react';
import SocketService from '../../services/socketService';
import SSEService from '../../services/SSEService';
import consoleService from '../../services/consoleService';
import { useAppContext } from '../../contexts/AppContext';
import { StreamingSource } from '@/types/api.types';

export const usePreview = () => {
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string>('Initializing...');
  const [interactiveMode, setInteractiveMode] = useState(false);
  const [currentUrl, setCurrentUrl] = useState<string>('');
  const [urlHistory, setUrlHistory] = useState<string[]>(['']);
  const [urlInput, setUrlInput] = useState<string>('');
  const previewRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const { streamingSource, setStreamingSource } = useAppContext();

  const handleSourceChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const newSource = event.target.value as StreamingSource;
    setStreamingSource(newSource);
    consoleService
      .getInstance()
      .emitConsoleEvent('info', `Streaming source changed to: ${newSource}`);
    setScreenshot(null);
    
    if (newSource === 'chrome-puppeteer') {
      // For chrome-puppeteer, connect using SSE.
      SSEService.getInstance().setSource(newSource);
      SSEService.getInstance().connect();
      // If switching from another source, disconnect the socket.
      SocketService.getInstance().disconnect();
    } else {
      // For other sources, use the Socket connection.
      SocketService.getInstance().setSource(newSource);
      SocketService.getInstance().connect();
      SocketService.getInstance().emit('start-stream', { source: newSource });
      // Ensure any previous SSE connection is disconnected.
      SSEService.getInstance().disconnect();
    }
  };

  const handleInteractiveModeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const enabled = event.target.checked;
    setInteractiveMode(enabled);
    // Assume interactive mode is only applicable to non-SSE (non-chrome-puppeteer) streams.
    if (streamingSource !== 'chrome-puppeteer') {
      // e.g., you might notify the socket service or another service here.
    }
  };

  const handleUrlSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (urlInput.trim() && streamingSource !== 'chrome-puppeteer') {
      const formattedUrl = urlInput.startsWith('http') ? urlInput : `https://${urlInput}`;
      setCurrentUrl(formattedUrl);
      setUrlHistory((prev) => [...prev, formattedUrl]);
      // For non-chrome-puppeteer sources, emit a URL change via the socket.
      SocketService.getInstance().emit('change-url', { url: formattedUrl });
    }
  };

  const handleBackNavigation = () => {
    if (urlHistory.length > 1 && streamingSource !== 'chrome-puppeteer') {
      const newHistory = [...urlHistory];
      newHistory.pop();
      const previousUrl = newHistory[newHistory.length - 1];
      setCurrentUrl(previousUrl);
      setUrlInput(previousUrl);
      setUrlHistory(newHistory);
      SocketService.getInstance().emit('change-url', { url: previousUrl });
    }
  };

  const handleInteraction = (event: React.MouseEvent | React.KeyboardEvent | WheelEvent) => {
    // For chrome-puppeteer SSE, interactive mode can be implemented if needed.
    if (!interactiveMode || !previewRef.current || !imageRef.current || streamingSource !== 'chrome-puppeteer') {
      return;
    }
    // Placeholder for handling interactions in SSE mode.
    console.log('Interactive event:', event);
  };

  // Main effect: subscribe to screen updates based on the current streaming source.
  useEffect(() => {
    if (streamingSource === 'chrome-puppeteer') {
      // Use SSE for chrome-puppeteer.
      const sseService = SSEService.getInstance();
      sseService.setSource(streamingSource);
      sseService.connect();

      const handleScreenStream = (event: CustomEvent) => {
        // event.detail contains the base64 image string.
        setScreenshot(`data:image/jpeg;base64,${event.detail}`);
        setStatus('SSE Connected');
        setError(null);
      };

      const handleSseError = (event: CustomEvent) => {
        setStatus('SSE Error');
        setError(event.detail);
      };

      window.addEventListener('screen-stream', handleScreenStream as EventListener);
      window.addEventListener('sse-error', handleSseError as EventListener);

      return () => {
        window.removeEventListener('screen-stream', handleScreenStream as EventListener);
        window.removeEventListener('sse-error', handleSseError as EventListener);
        sseService.disconnect();
      };
    } else {
      // Use Socket for non-chrome-puppeteer sources.
      const socketService = SocketService.getInstance();
      socketService.setSource(streamingSource);
      const socket = socketService.connect();

      socket.on('browser-started', () => {
        setStatus('VNC Connected');
        setError(null);
      });

      socket.on('browser-error', ({ message }: { message: string }) => {
        setStatus('VNC Error');
        setError(message);
      });

      socket.on('screenshot-snapshot', (base64Image: string) => {
        setScreenshot(`data:image/jpeg;base64,${base64Image}`);
      });

      return () => {
        socket.off('browser-started');
        socket.off('browser-error');
        socket.off('screenshot-snapshot');
      };
    }
  }, [streamingSource]);

  // Optionally, if interactive mode for chrome-puppeteer is needed,
  // add an event listener to the preview element.
  useEffect(() => {
    if (!previewRef.current || !interactiveMode || streamingSource !== 'chrome-puppeteer') return;

    const element = previewRef.current;
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      handleInteraction(e);
    };

    element.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      element.removeEventListener('wheel', handleWheel);
    };
  }, [interactiveMode, streamingSource]);

  return {
    screenshot,
    error,
    status,
    streamingSource,
    interactiveMode,
    currentUrl,
    urlHistory,
    urlInput,
    previewRef,
    imageRef,
    handleSourceChange,
    handleInteractiveModeChange,
    handleUrlSubmit,
    handleBackNavigation,
    handleInteraction,
    setUrlInput
  };
};
