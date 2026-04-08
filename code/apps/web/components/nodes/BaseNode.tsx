"use client";

import { useState } from "react";
import { Handle, Position } from "@xyflow/react";
import { MoreHorizontal, Play, Power, Star, Trash2 } from "lucide-react";
import { useCanvasActions } from "@/lib/contexts/CanvasActionsContext";

export type BaseNodeProps = {
  title: string;
  subtitle: string;
  colorClass: string;
  /** Optional icon shown before the title */
  icon?: React.ReactNode;
  /** When provided with nodeId, hover toolbar and add-next are shown */
  nodeId?: string;
  selected?: boolean;
  /** When true, show + button for adding next node (right side) */
  showAddNext?: boolean;
  /** Optional visual badges rendered under the subtitle (model, tools, etc.) */
  badges?: string[];
};

export function BaseNode({
  title,
  subtitle,
  colorClass,
  icon,
  nodeId,
  selected = false,
  showAddNext = true,
  badges,
}: BaseNodeProps) {
  const actions = useCanvasActions();
  const [hovered, setHovered] = useState(false);
  const showToolbar = (selected || hovered) && actions && nodeId;

  return (
    <div
      className="relative min-w-[208px] max-w-[280px] rounded-lg border border-zinc-700 bg-zinc-900/95 p-3 text-white shadow-lg ring-1 ring-zinc-800/50"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <Handle type="target" position={Position.Left} className="!h-2.5 !w-2.5 !bg-zinc-300" />

      {showToolbar && (
        <div className="absolute -top-9 left-0 right-0 flex justify-center gap-0.5 rounded-md border border-zinc-700 bg-zinc-800 py-1 px-1 shadow-lg">
          <button
            type="button"
            title="Test this node"
            onClick={(e) => {
              e.stopPropagation();
              actions.onTestNode(nodeId!);
            }}
            className="rounded p-1.5 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200"
            disabled={!actions.canRun}
          >
            <Play className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            title="Enable/disable"
            onClick={(e) => {
              e.stopPropagation();
              actions.onToggleDisabled(nodeId!);
            }}
            className="rounded p-1.5 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200"
          >
            <Power className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            title="Delete"
            onClick={(e) => {
              e.stopPropagation();
              actions.onDeleteNode(nodeId!);
            }}
            className="rounded p-1.5 text-zinc-400 hover:bg-zinc-700 hover:text-red-400"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            title="Favorite"
            className="rounded p-1.5 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200"
          >
            <Star className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            title="More options"
            className="rounded p-1.5 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200"
          >
            <MoreHorizontal className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      <div className={`mb-2 inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-xs font-medium ${colorClass}`}>
        {icon && <span className="opacity-90">{icon}</span>}
        {title}
      </div>
      <p className="text-xs text-zinc-400">{subtitle}</p>
      {badges && badges.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-1">
          {badges.map((badge) => (
            <span
              key={badge}
              className="rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] font-medium text-zinc-300"
            >
              {badge}
            </span>
          ))}
        </div>
      )}

      <div className="mt-2 flex items-center justify-end gap-1">
        <Handle type="source" position={Position.Right} className="!h-2.5 !w-2.5 !bg-zinc-300" />
        {showAddNext && actions && nodeId && (
          <button
            type="button"
            title="Add next step"
            onClick={(e) => {
              e.stopPropagation();
              actions.onAddNextNode(nodeId);
            }}
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-zinc-600 bg-zinc-800 text-zinc-300 shadow hover:border-zinc-500 hover:bg-zinc-700 hover:text-white"
          >
            +
          </button>
        )}
      </div>
    </div>
  );
}
