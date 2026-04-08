"use client";

import { Trash2 } from "lucide-react";
import { useState } from "react";
import { deleteGraph } from "@/lib/api/graphs";

interface GraphDeleteButtonProps {
  graphId: string;
  graphTitle: string;
  onDeleted: () => void;
}

export function GraphDeleteButton({ graphId, graphTitle, onDeleted }: GraphDeleteButtonProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function handleDelete() {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setIsDeleting(true);
    try {
      await deleteGraph(graphId);
      onDeleted();
    } catch {
      setConfirmDelete(false);
    } finally {
      setIsDeleting(false);
    }
  }

  function handleCancel() {
    setConfirmDelete(false);
  }

  if (confirmDelete) {
    return (
      <div className="flex flex-wrap gap-1">
        <span className="text-[11px] text-amber-400">Delete?</span>
        <button
          type="button"
          onClick={handleDelete}
          disabled={isDeleting}
          className="rounded bg-red-900/60 px-2 py-1 text-[11px] font-medium text-red-200 hover:bg-red-800/60 disabled:opacity-50"
        >
          {isDeleting ? "…" : "Yes"}
        </button>
        <button
          type="button"
          onClick={handleCancel}
          disabled={isDeleting}
          className="rounded bg-zinc-700 px-2 py-1 text-[11px] font-medium text-zinc-200 hover:bg-zinc-600"
        >
          No
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={handleDelete}
      disabled={isDeleting}
      title={`Delete "${graphTitle}"`}
      className="flex items-center gap-1 rounded bg-zinc-800 px-2 py-1 text-[11px] font-medium text-zinc-400 hover:bg-red-900/40 hover:text-red-200"
    >
      <Trash2 className="h-3 w-3" />
      Delete
    </button>
  );
}
