"use client";

import { useMemo, useState } from "react";
import { ChevronRight, Clock, FileInput, Link2, MousePointer, Wifi } from "lucide-react";
import type { ForgeNodeType } from "@/lib/stores/graphStore";
import { Input } from "@/components/ui/input";

export type TriggerOptionType =
  | "manual_trigger"
  | "webhook_trigger"
  | "schedule_trigger"
  | "form_submission_trigger"
  | "app_event_trigger";

const TRIGGER_OPTIONS: Array<{
  type: TriggerOptionType;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  {
    type: "manual_trigger",
    label: "When I click Run",
    description: "Start the workflow yourself. Easiest way to test — just click Run and see what happens.",
    icon: MousePointer,
  },
  {
    type: "webhook_trigger",
    label: "When someone sends a web request",
    description: "Another app or a form can send data to a URL; your workflow runs automatically.",
    icon: Link2,
  },
  {
    type: "schedule_trigger",
    label: "On a schedule",
    description: "Run every hour, daily, or at a custom time (e.g. send a morning summary).",
    icon: Clock,
  },
  {
    type: "form_submission_trigger",
    label: "When a form is submitted",
    description: "Create a form people can fill out; their answers start the workflow.",
    icon: FileInput,
  },
  {
    type: "app_event_trigger",
    label: "When something happens in an app",
    description: "Start from events in tools like Telegram, Notion, or Airtable.",
    icon: Wifi,
  },
];

interface TriggerPickerOverlayProps {
  onSelect: (nodeType: ForgeNodeType) => void;
  onClose: () => void;
}

export function TriggerPickerOverlay({ onSelect, onClose }: TriggerPickerOverlayProps) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search.trim()) return TRIGGER_OPTIONS;
    const q = search.trim().toLowerCase();
    return TRIGGER_OPTIONS.filter(
      (o) =>
        o.label.toLowerCase().includes(q) || o.description.toLowerCase().includes(q),
    );
  }, [search]);

  return (
    <div className="absolute right-0 top-0 z-30 flex h-full w-[400px] flex-col border-l border-zinc-800 bg-zinc-950 shadow-xl">
      <div className="border-b border-zinc-800 p-4">
        <h2 className="text-sm font-semibold text-zinc-100">When should this workflow start?</h2>
        <p className="mt-0.5 text-xs text-zinc-400">Pick how you want to start it. You can add more steps after.</p>
        <div className="mt-3">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search nodes..."
            className="h-9 bg-zinc-900"
          />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        {filtered.map((option) => {
          const Icon = option.icon;
          return (
            <button
              key={option.type}
              type="button"
              onClick={() => onSelect(option.type as ForgeNodeType)}
              className="flex w-full items-center gap-3 rounded-lg border border-transparent px-3 py-2.5 text-left transition hover:border-zinc-700 hover:bg-zinc-900/80"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-zinc-800">
                <Icon className="h-4 w-4 text-zinc-400" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-zinc-200">{option.label}</p>
                <p className="text-xs text-zinc-500">{option.description}</p>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-zinc-500" />
            </button>
          );
        })}
        {filtered.length === 0 && (
          <p className="px-3 py-4 text-xs text-zinc-500">No triggers match your search.</p>
        )}
      </div>
      <div className="border-t border-zinc-800 p-2">
        <button
          type="button"
          onClick={onClose}
          className="w-full rounded-md border border-zinc-700 px-3 py-2 text-xs text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
        >
          Close
        </button>
      </div>
    </div>
  );
}
