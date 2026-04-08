"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";

export type NodeStatusMap = Record<
  string,
  "pending" | "running" | "success" | "error" | "paused" | "skipped"
>;

export interface ExecutionEvent {
  event_type:
    | "node_started"
    | "token"
    | "node_completed"
    | "node_failed"
    | "execution_completed"
    | "execution_failed"
    | "execution_cancelled"
    | "approval_required"
    | "checkpoint_saved"
    | "replay";
  run_id: string;
  node_id?: string;
  data: Record<string, unknown>;
  timestamp?: string;
}

export interface UseExecutionState {
  isConnected: boolean;
  isRunning: boolean;
  nodeStatuses: NodeStatusMap;
  tokenStreams: Record<string, string>;
  events: ExecutionEvent[];
  error: string | null;
  runId: string | null;
  startExecution: (
    graphId: string,
    inputData?: Record<string, unknown>,
    secrets?: Record<string, string>,
  ) => Promise<void>;
  cancelExecution: () => Promise<void>;
  approveStep: (approved: boolean, feedback?: string) => Promise<void>;
  resetExecution: () => void;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const WS_URL = API_URL.replace(/^http/, "ws");

function getSupabase() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

export function useExecution(): UseExecutionState {
  const [isConnected, setIsConnected] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [nodeStatuses, setNodeStatuses] = useState<NodeStatusMap>({});
  const [tokenStreams, setTokenStreams] = useState<Record<string, string>>({});
  const [events, setEvents] = useState<ExecutionEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [runId, setRunId] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const currentRunIdRef = useRef<string | null>(null);
  const runningRef = useRef(false);

  useEffect(() => {
    runningRef.current = isRunning;
  }, [isRunning]);

  const resetExecution = useCallback(() => {
    setIsRunning(false);
    setNodeStatuses({});
    setTokenStreams({});
    setEvents([]);
    setError(null);
    setRunId(null);
    currentRunIdRef.current = null;
  }, []);

  const connectWebSocket = useCallback(async (rid: string) => {
    const supabase = getSupabase();
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return;

    const url = `${WS_URL}/executions/ws/${rid}?token=${encodeURIComponent(token)}`;
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
      reconnectAttemptsRef.current = 0;
    };

    ws.onmessage = (evt) => {
      try {
        const event: ExecutionEvent = JSON.parse(evt.data as string);
        setEvents((prev) => [...prev, event]);

        switch (event.event_type) {
          case "node_started":
            if (event.node_id) {
              setNodeStatuses((prev) => ({ ...prev, [event.node_id!]: "running" }));
            }
            break;
          case "token":
            if (event.node_id) {
              const tok = String((event.data as { token?: string }).token ?? "");
              setTokenStreams((prev) => ({
                ...prev,
                [event.node_id!]: (prev[event.node_id!] ?? "") + tok,
              }));
            }
            break;
          case "node_completed":
            if (event.node_id) {
              const st = (event.data as { status?: string }).status ?? "success";
              setNodeStatuses((prev) => ({
                ...prev,
                [event.node_id!]: st as NodeStatusMap[string],
              }));
            }
            break;
          case "node_failed":
            if (event.node_id) {
              setNodeStatuses((prev) => ({ ...prev, [event.node_id!]: "error" }));
            }
            break;
          case "approval_required":
            if (event.node_id) {
              setNodeStatuses((prev) => ({ ...prev, [event.node_id!]: "paused" }));
            }
            break;
          case "execution_completed":
            setIsRunning(false);
            ws.close();
            break;
          case "execution_failed": {
            setIsRunning(false);
            const raw = String((event.data as { error?: string }).error ?? "Execution failed");
            const isAuthError =
              /incorrect api key|authenticationerror|openai_exception|OPENAI_API_KEY/i.test(raw);
            setError(
              isAuthError
                ? "API key invalid or missing. Enter your API key in Run settings on the canvas."
                : raw
            );
            ws.close();
            break;
          }
          case "execution_cancelled":
            setIsRunning(false);
            setError("Execution cancelled.");
            ws.close();
            break;
          case "replay": {
            const checkpoints =
              (event as ExecutionEvent & { checkpoints?: Array<{ node_id: string }> }).checkpoints ??
              (event.data as { checkpoints?: Array<{ node_id: string }> }).checkpoints;
            if (Array.isArray(checkpoints)) {
              setNodeStatuses((prev) => {
                const next = { ...prev };
                for (const item of checkpoints) {
                  if (item?.node_id) {
                    next[item.node_id] = "success";
                  }
                }
                return next;
              });
            }
            break;
          }
        }
      } catch {
        // non-JSON message ignored
      }
    };

    ws.onerror = () => {
      setIsConnected(false);
    };

    ws.onclose = () => {
      setIsConnected(false);
      wsRef.current = null;
      // Reconnect only while a run is active (I2-C-04: WS reliability). Terminal events
      // (execution_completed, execution_failed, execution_cancelled) set isRunning false
      // and close the socket, so we do not reconnect after run completion.
      if (currentRunIdRef.current && runningRef.current) {
        const delay = Math.min(1000 * 2 ** reconnectAttemptsRef.current, 30000);
        reconnectAttemptsRef.current += 1;
        reconnectTimerRef.current = setTimeout(() => {
          if (currentRunIdRef.current) {
            connectWebSocket(currentRunIdRef.current);
          }
        }, delay);
      }
    };
  }, []);

  useEffect(() => {
    return () => {
      wsRef.current?.close();
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
    };
  }, []);

  const startExecution = useCallback(
    async (
      graphId: string,
      inputData: Record<string, unknown> = {},
      secrets: Record<string, string> = {},
    ) => {
      const supabase = getSupabase();
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("Not authenticated");

      setError(null);
      setNodeStatuses({});
      setTokenStreams({});
      setEvents([]);

      const body: { graph_id: string; input_data: Record<string, unknown>; secrets?: Record<string, string> } = {
        graph_id: graphId,
        input_data: inputData,
      };
      if (Object.keys(secrets).length > 0) body.secrets = secrets;

      const resp = await fetch(`${API_URL}/executions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ detail: "Unknown error" }));
        throw new Error(String((err as { detail?: string }).detail ?? "Failed to start execution"));
      }

      const { run_id } = (await resp.json()) as { run_id: string };
      setRunId(run_id);
      setIsRunning(true);
      currentRunIdRef.current = run_id;
      await connectWebSocket(run_id);
    },
    [connectWebSocket],
  );

  const cancelExecution = useCallback(async () => {
    if (!runId) return;
    const supabase = getSupabase();
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return;

    await fetch(`${API_URL}/executions/${runId}/cancel`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    setIsRunning(false);
    wsRef.current?.close();
  }, [runId]);

  const approveStep = useCallback(
    async (approved: boolean, feedback?: string) => {
      if (!runId) return;
      const supabase = getSupabase();
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) return;

      await fetch(`${API_URL}/executions/${runId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ approved, feedback }),
      });
    },
    [runId],
  );

  return {
    isConnected,
    isRunning,
    nodeStatuses,
    tokenStreams,
    events,
    error,
    runId,
    startExecution,
    cancelExecution,
    approveStep,
    resetExecution,
  };
}
