"use client";

import { AlertCircle, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ErrorAlertProps {
  message: string;
  /** Suggested fix to display below the error */
  hint?: string;
  onDismiss?: () => void;
  className?: string;
}

export function ErrorAlert({
  message,
  hint,
  onDismiss,
  className,
}: ErrorAlertProps) {
  return (
    <div
      role="alert"
      className={cn(
        "flex gap-3 rounded-lg border border-red-900/50 bg-red-950/30 px-4 py-3 text-sm",
        className,
      )}
    >
      <AlertCircle className="h-5 w-5 shrink-0 text-red-400" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="font-medium text-red-200">{message}</p>
        {hint && (
          <p className="mt-1 text-xs text-red-300/90">{hint}</p>
        )}
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 rounded p-1 text-red-400 hover:bg-red-900/30 hover:text-red-200"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

/** Map common error patterns to plain-language suggested fixes for non-technical users */
export function getErrorHint(error: string): string | undefined {
  const hints: Array<{ match: RegExp; hint: string }> = [
    {
      match: /api key|openai_api_key|authentication.*key|incorrect api key|invalid.*key/i,
      hint: "Open Run settings (gear next to Run), add your API key, then try running again.",
    },
    {
      match: /not authenticated|missing user session|401|unauthorized/i,
      hint: "Please sign out and sign in again, then try again.",
    },
    {
      match: /autosave failed|check api|auth setup/i,
      hint: "Make sure you're signed in and the app can reach the server. If it keeps failing, try refreshing.",
    },
    {
      match: /failed to load graph|404|not found/i,
      hint: "This workflow may have been deleted. Go back to the dashboard and open another one.",
    },
    {
      match: /save the graph first/i,
      hint: "Click Run — the workflow will save automatically when you run it the first time.",
    },
    {
      match: /add at least one node/i,
      hint: "Add a step first: click “Add node” and choose “When I click Run” to get started.",
    },
    {
      match: /cycle detected|graph contains a cycle/i,
      hint: "Your connections form a loop. Remove one connection so the flow goes in one direction.",
    },
    {
      match: /bucket not found|storage/i,
      hint: "Export needs storage set up. For now, try Export Code again — it may still download the file.",
    },
    {
      match: /unable to load|check api|auth configuration/i,
      hint: "Make sure you're signed in and try again. If the problem continues, refresh the page.",
    },
  ];
  return hints.find((h) => h.match.test(error))?.hint;
}
