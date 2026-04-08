"use client";

import { memo } from "react";
import { useOthers } from "@liveblocks/react";

import { CollaborationCursors } from "./CollaborationCursors";

/** Maps Liveblocks others() to the presentational CollaborationCursors component. */
export const CollaborationCursorsLive = memo(function CollaborationCursorsLive() {
  const others = useOthers();
  const remoteUsers = others.map((o) => ({
    connectionId: o.connectionId,
    presence: {
      cursor: o.presence.cursor ?? null,
      selectedNodeId: o.presence.selectedNodeId ?? null,
      userColor: o.presence.userColor ?? "#888",
      userName: o.presence.userName ?? "User",
    },
  }));
  return <CollaborationCursors remoteUsers={remoteUsers} />;
});
