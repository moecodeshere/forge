"use client";

import { createContext, useContext } from "react";

export type PublishPresenceFn = (
  cursor: { x: number; y: number } | null,
  selectedNodeId: string | null,
) => void;

const CollaborationPresenceContext = createContext<PublishPresenceFn>(() => {});

export function CollaborationPresenceProvider({
  value,
  children,
}: {
  value: PublishPresenceFn;
  children: React.ReactNode;
}) {
  return (
    <CollaborationPresenceContext.Provider value={value}>
      {children}
    </CollaborationPresenceContext.Provider>
  );
}

export function useCollaborationPresence(): PublishPresenceFn {
  return useContext(CollaborationPresenceContext);
}
