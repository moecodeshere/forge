"use client";

/**
 * CollaborationCursors renders remote user presence (cursors + selection rings)
 * inside the React Flow canvas viewport.
 *
 * Liveblocks integration is opt-in; if no public key is configured the component
 * renders nothing and the rest of the canvas works normally (single-user mode).
 */
import { memo } from "react";

interface RemoteUser {
  connectionId: number;
  presence: {
    cursor: { x: number; y: number } | null;
    selectedNodeId: string | null;
    userColor: string;
    userName: string;
  };
}

interface CollaborationCursorsProps {
  remoteUsers?: RemoteUser[];
}

export const CollaborationCursors = memo(function CollaborationCursors({
  remoteUsers = [],
}: CollaborationCursorsProps) {
  if (remoteUsers.length === 0) return null;

  return (
    <>
      {remoteUsers.map((user) => {
        if (!user.presence.cursor) return null;
        return (
          <div
            key={user.connectionId}
            className="pointer-events-none absolute z-50"
            style={{
              left: user.presence.cursor.x,
              top: user.presence.cursor.y,
              transform: "translate(-4px, -4px)",
            }}
          >
            {/* Cursor SVG */}
            <svg width="16" height="20" viewBox="0 0 16 20" fill="none">
              <path
                d="M0 0L0 14L4 10L7 17L9 16L6 9L11 9Z"
                fill={user.presence.userColor}
                stroke="white"
                strokeWidth="1"
              />
            </svg>
            {/* Name badge */}
            <div
              className="mt-0.5 whitespace-nowrap rounded px-1.5 py-0.5 text-[10px] font-semibold text-white shadow"
              style={{ backgroundColor: user.presence.userColor }}
            >
              {user.presence.userName}
            </div>
          </div>
        );
      })}
    </>
  );
});
