"use client";

import { useState, useEffect } from "react";
import { Plus, Sparkles, GitBranch, Play, Save, X } from "lucide-react";
import Link from "next/link";

const ONBOARDING_KEY = "forge_canvas_onboarding_dismissed";

interface EmptyCanvasStateProps {
  onAddFirstStep: () => void;
  onBuildWithAI: () => void;
}

export function EmptyCanvasState({ onAddFirstStep, onBuildWithAI }: EmptyCanvasStateProps) {
  const [showTour, setShowTour] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      setShowTour(window.localStorage.getItem(ONBOARDING_KEY) !== "true");
    } catch {
      setShowTour(true);
    }
  }, []);

  const dismissTour = () => {
    try {
      window.localStorage.setItem(ONBOARDING_KEY, "true");
    } catch {
      /* ignore */
    }
    setShowTour(false);
  };

  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center">
      {/* Dismissible onboarding tour — only on first visit */}
      {showTour && (
        <div className="absolute left-4 top-14 z-20 max-w-xs rounded-xl border border-zinc-700 bg-zinc-900/95 p-4 shadow-xl">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-200">Quick start</span>
            <button
              type="button"
              onClick={dismissTour}
              className="rounded p-1 text-zinc-500 hover:bg-zinc-700 hover:text-zinc-300"
              aria-label="Dismiss"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <ol className="space-y-2 text-[11px] text-zinc-400">
            <li className="flex items-center gap-2">
              <Plus className="h-3.5 w-3.5 shrink-0 text-zinc-500" />
              Add a node (trigger or step)
            </li>
            <li className="flex items-center gap-2">
              <GitBranch className="h-3.5 w-3.5 shrink-0 text-zinc-500" />
              Connect nodes by dragging between handles
            </li>
            <li className="flex items-center gap-2">
              <Play className="h-3.5 w-3.5 shrink-0 text-zinc-500" />
              Run to execute the workflow
            </li>
            <li className="flex items-center gap-2">
              <Save className="h-3.5 w-3.5 shrink-0 text-zinc-500" />
              Save (auto-saves as you edit)
            </li>
          </ol>
          <div className="mt-3 flex items-center justify-between gap-2 border-t border-zinc-700 pt-3">
            <Link
              href="/help"
              className="text-[11px] font-medium text-indigo-400 hover:underline"
            >
              Full help →
            </Link>
            <button
              type="button"
              onClick={dismissTour}
              className="rounded bg-zinc-700 px-2 py-1 text-[11px] font-medium text-zinc-200 hover:bg-zinc-600"
            >
              Got it
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-col items-center gap-6">
        <div className="flex flex-wrap items-center justify-center gap-6">
          <button
            type="button"
            onClick={onAddFirstStep}
            className="flex min-h-[140px] min-w-[200px] flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-zinc-600 bg-zinc-900/50 p-6 text-zinc-200 transition hover:border-zinc-500 hover:bg-zinc-800/50"
          >
            <Plus className="h-10 w-10 text-zinc-400" strokeWidth={2} />
            <span className="text-sm font-medium">Add your first node</span>
            <span className="text-xs text-zinc-500">Start with a trigger, then add steps</span>
          </button>
          <span className="text-sm text-zinc-500">or</span>
          <button
            type="button"
            onClick={onBuildWithAI}
            className="flex min-h-[140px] min-w-[200px] flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-zinc-600 bg-zinc-900/50 p-6 text-zinc-200 transition hover:border-zinc-500 hover:bg-zinc-800/50"
          >
            <Sparkles className="h-10 w-10 text-zinc-400" strokeWidth={2} />
            <span className="text-sm font-medium">Create with AI</span>
            <span className="text-xs text-zinc-500">e.g. invoice pipeline, lead qual, RAG assistant</span>
          </button>
        </div>
      </div>
    </div>
  );
}
