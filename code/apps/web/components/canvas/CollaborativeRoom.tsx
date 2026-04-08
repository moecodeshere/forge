"use client";

import { useCallback, useMemo } from "react";
import {
  ClientSideSuspense,
  LiveblocksProvider,
  RoomProvider,
  useSelf,
  useUpdateMyPresence,
} from "@liveblocks/react";

import {
  CollaborationPresenceProvider,
  type PublishPresenceFn,
} from "@/lib/contexts/CollaborationPresenceContext";
import { consumeLiveblocksInitialGraph } from "@/lib/liveblocksDraftSeed";

import { LiveblocksGraphBridge } from "./LiveblocksGraphBridge";

function PresenceBinding({ children }: { children: React.ReactNode }) {
  const updatePresence = useUpdateMyPresence();
  const self = useSelf();
  const userName = (self?.info?.name as string | undefined) ?? "Collaborator";
  const userColor = (self?.info?.color as string | undefined) ?? "#22c55e";

  const publishPresence = useCallback<PublishPresenceFn>(
    (cursor, selectedNodeId) => {
      updatePresence({ cursor, selectedNodeId, userColor, userName });
    },
    [updatePresence, userColor, userName],
  );

  return (
    <CollaborationPresenceProvider value={publishPresence}>
      {children}
    </CollaborationPresenceProvider>
  );
}

export function CollaborativeRoom({
  roomId,
  children,
}: {
  roomId: string;
  children: React.ReactNode;
}) {
  const initialStorage = useMemo(() => {
    const graph = consumeLiveblocksInitialGraph(roomId);
    return { graph };
  }, [roomId]);

  return (
    <LiveblocksProvider authEndpoint="/api/liveblocks-auth">
      <RoomProvider
        id={roomId}
        initialPresence={{
          cursor: null,
          selectedNodeId: null,
          userColor: "#22c55e",
          userName: "You",
        }}
        initialStorage={initialStorage}
      >
        <ClientSideSuspense fallback={null}>
          <PresenceBinding>
            <LiveblocksGraphBridge />
            {children}
          </PresenceBinding>
        </ClientSideSuspense>
      </RoomProvider>
    </LiveblocksProvider>
  );
}
