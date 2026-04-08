"use client";

import { createContext, useContext } from "react";

export interface CanvasActionsContextValue {
  onTestNode: (nodeId: string) => void;
  onDeleteNode: (nodeId: string) => void;
  onToggleDisabled: (nodeId: string) => void;
  onAddNextNode: (sourceNodeId: string) => void;
  /** When adding a node between two nodes (from edge + button) */
  onAddBetween: (edgeId: string, sourceId: string, targetId: string) => void;
  canRun: boolean;
}

const CanvasActionsContext = createContext<CanvasActionsContextValue | null>(null);

export function useCanvasActions(): CanvasActionsContextValue | null {
  return useContext(CanvasActionsContext);
}

export function CanvasActionsProvider({
  children,
  value,
}: {
  children: React.ReactNode;
  value: CanvasActionsContextValue;
}) {
  return (
    <CanvasActionsContext.Provider value={value}>
      {children}
    </CanvasActionsContext.Provider>
  );
}
