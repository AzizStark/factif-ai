import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { IExploreGraphData, IExploreSessionMeta } from "@/types/message.types.ts";
import { getSessionsList } from "@/utils/exploreHistoryManager";

interface ExploreModeContextProps {
  showGraph: boolean;
  setShowGraph: (showGraph: boolean) => void;
  isExploreMode: boolean;
  setIsExploreMode: (isExploreMode: boolean) => void;
  graphData: IExploreGraphData;
  setGraphData: (graphData: IExploreGraphData) => void;
  recentSessions: IExploreSessionMeta[];
  setRecentSessions: (sessions: IExploreSessionMeta[]) => void;
  showRecentChats: boolean;
  setShowRecentChats: (show: boolean) => void;
  loadSession: (sessionId: string) => void;
  registerLoadSessionFn: (fn: (sessionId: string) => void) => void;
}

const ExploreModeContext = createContext<ExploreModeContextProps | undefined>(
  undefined,
);

export const useExploreModeContext = () => {
  const context = useContext(ExploreModeContext);
  if (!context) {
    throw new Error(
      "useExploreModeContext must be used within a ExploreModeProvider",
    );
  }
  return context;
};

export const ExploreModeProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [showGraph, setShowGraph] = useState(false);
  const [isExploreMode, setIsExploreMode] = useState(false);
  const [graphData, setGraphData] = useState<IExploreGraphData>({
    nodes: [],
    edges: [],
  });
  const [recentSessions, setRecentSessions] = useState<IExploreSessionMeta[]>([]);
  const [showRecentChats, setShowRecentChats] = useState(false);

  // Load recent sessions from localStorage on mount
  useEffect(() => {
    const sessions = getSessionsList();
    setRecentSessions(sessions);
  }, []);
  
  // State to store the loadSession function from useExploreChat
  const [loadSessionFn, setLoadSessionFn] = useState<(sessionId: string) => void>(() => 
    (sessionId: string) => {
      console.log(`Default loadSession stub, session ID: ${sessionId}`);
      setShowRecentChats(false);
    }
  );
  
  // Function that will be provided to consumers of the context
  const loadSession = (sessionId: string) => {
    loadSessionFn(sessionId);
  };
  
  // Function to register the real implementation from useExploreChat
  // Using useCallback to maintain a stable function reference across renders
  const registerLoadSessionFn = useCallback((fn: (sessionId: string) => void) => {
    setLoadSessionFn(() => fn);
  }, []);

  const value = {
    showGraph,
    setShowGraph,
    isExploreMode,
    setIsExploreMode,
    graphData,
    setGraphData,
    recentSessions,
    setRecentSessions,
    showRecentChats,
    setShowRecentChats,
    loadSession,
    registerLoadSessionFn,
  };
  return (
    <ExploreModeContext.Provider value={value}>
      {children}
    </ExploreModeContext.Provider>
  );
};
