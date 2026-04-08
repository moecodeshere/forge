"use client";

import "@xyflow/react/dist/style.css";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Maximize2 } from "lucide-react";
import {
  Background,
  Controls,
  type EdgeChange,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
} from "@xyflow/react";
import type { NodeTypes } from "@xyflow/react";

import { ActionNode } from "@/components/nodes/ActionNode";
import { AiAgentNode } from "@/components/nodes/AiAgentNode";
import { AppEventTriggerNode } from "@/components/nodes/AppEventTriggerNode";
import { ApprovalStepNode } from "@/components/nodes/ApprovalStepNode";
import { ConditionalBranchNode } from "@/components/nodes/ConditionalBranchNode";
import { DelayNode } from "@/components/nodes/DelayNode";
import { ErrorHandlerNode } from "@/components/nodes/ErrorHandlerNode";
import { FilterNode } from "@/components/nodes/FilterNode";
import { FormSubmissionTriggerNode } from "@/components/nodes/FormSubmissionTriggerNode";
import { HttpRequestNode } from "@/components/nodes/HttpRequestNode";
import { JsonParseNode } from "@/components/nodes/JsonParseNode";
import { JsonStringifyNode } from "@/components/nodes/JsonStringifyNode";
import { LLMCallerNode } from "@/components/nodes/LLMCallerNode";
import { LoopNode } from "@/components/nodes/LoopNode";
import { ManualTriggerNode } from "@/components/nodes/ManualTriggerNode";
import { MCPToolNode } from "@/components/nodes/MCPToolNode";
import { MergeNode } from "@/components/nodes/MergeNode";
import { PdfReportNode } from "@/components/nodes/PdfReportNode";
import { RAGRetrieverNode } from "@/components/nodes/RAGRetrieverNode";
import { ResearchNode } from "@/components/nodes/ResearchNode";
import { ScheduleTriggerNode } from "@/components/nodes/ScheduleTriggerNode";
import { SetNode } from "@/components/nodes/SetNode";
import { SimpleLLMNode } from "@/components/nodes/SimpleLLMNode";
import { SqlQueryNode } from "@/components/nodes/SqlQueryNode";
import { TemplateRenderNode } from "@/components/nodes/TemplateRenderNode";
import { VisionExtractNode } from "@/components/nodes/VisionExtractNode";
import { WaitCallbackNode } from "@/components/nodes/WaitCallbackNode";
import { WebhookTriggerNode } from "@/components/nodes/WebhookTriggerNode";
import { WebScrapeNode } from "@/components/nodes/WebScrapeNode";
import { DeployModal } from "@/components/deploy/DeployModal";
import { NodeConfigPanel } from "@/components/panels/NodeConfigPanel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ErrorAlert } from "@/components/ui/error-alert";
import {
  logSuggestionTelemetry,
  suggestWorkflow,
  type WorkflowSuggestion,
} from "@/lib/api/aiBuilder";
import { createGraph, getGraph, updateGraph } from "@/lib/api/graphs";
import { useExecution } from "@/lib/hooks/useExecution";
import { CanvasActionsProvider } from "@/lib/contexts/CanvasActionsContext";
import { useCollaborationPresence } from "@/lib/contexts/CollaborationPresenceContext";
import {
  type ForgeNodeType,
  type ForgeNodeData,
  useGraphStore,
} from "@/lib/stores/graphStore";
import { stashDraftGraphForNewRoom } from "@/lib/liveblocksDraftSeed";
import { getTemplateById, TEMPLATE_DEFAULT_VIEWPORT } from "@/lib/templates/workflows";

import { ExecutionLogPanel } from "../panels/ExecutionLogPanel";
import { MCPSearchPanel } from "../panels/MCPSearchPanel";
import { CollaborationCursorsLive } from "./CollaborationCursorsLive";
import { CollaborativeRoom } from "./CollaborativeRoom";
import { EmptyCanvasState } from "./EmptyCanvasState";
import { NextStepPicker } from "./NextStepPicker";
import { NodePalette } from "./NodePalette";
import { TriggerPickerOverlay } from "./TriggerPickerOverlay";

/** Every `ForgeNodeType` must map here so the canvas renders real nodes (palette/AI already list them). */
const nodeTypes: NodeTypes = {
  manual_trigger: ManualTriggerNode,
  webhook_trigger: WebhookTriggerNode,
  schedule_trigger: ScheduleTriggerNode,
  form_submission_trigger: FormSubmissionTriggerNode,
  app_event_trigger: AppEventTriggerNode,
  ai_agent: AiAgentNode,
  llm_caller: LLMCallerNode,
  simple_llm: SimpleLLMNode,
  rag_retriever: RAGRetrieverNode,
  research: ResearchNode,
  web_scrape: WebScrapeNode,
  vision_extract: VisionExtractNode,
  sql_query: SqlQueryNode,
  loop: LoopNode,
  template_render: TemplateRenderNode,
  pdf_report: PdfReportNode,
  wait_callback: WaitCallbackNode,
  error_handler: ErrorHandlerNode,
  conditional_branch: ConditionalBranchNode,
  mcp_tool: MCPToolNode,
  action: ActionNode,
  http_request: HttpRequestNode,
  set_node: SetNode,
  approval_step: ApprovalStepNode,
  delay: DelayNode,
  json_parse: JsonParseNode,
  json_stringify: JsonStringifyNode,
  merge: MergeNode,
  filter: FilterNode,
};

function CanvasContent({ graphId }: { graphId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  /** Stable primitive for effect deps — `searchParams` object identity can change every render. */
  const templateQuery = searchParams.get("template");
  const reactFlow = useReactFlow();
  const reactFlowRef = useRef(reactFlow);
  reactFlowRef.current = reactFlow;
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [resolvedGraphId, setResolvedGraphId] = useState<string>(graphId);
  const [aiPrompt, setAiPrompt] = useState("");
  const [isSuggesting, setIsSuggesting] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragSnapshotRef = useRef(false);
  const {
    isRunning,
    nodeStatuses,
    tokenStreams,
    events,
    error: executionError,
    startExecution,
    cancelExecution,
    approveStep,
  } = useExecution();

  const {
    nodes,
    edges,
    selectedNodeId,
    isDirty,
    canUndo,
    setNodes,
    setEdges,
    setSelectedNodeId,
    onNodesChange,
    onEdgesChange,
    onConnect,
    pushHistory,
    undo,
    markSaved,
  } = useGraphStore();

  const [isRegenerating, setIsRegenerating] = useState(false);
  const [showDeploy, setShowDeploy] = useState(false);
  const [showMcpSearch, setShowMcpSearch] = useState(false);
  const [showRunSettings, setShowRunSettings] = useState(false);
  const [showNodePalette, setShowNodePalette] = useState(false);
  const [activeCanvasTab, setActiveCanvasTab] = useState<"editor" | "executions" | "evaluations">(
    "editor",
  );
  const [runSecrets, setRunSecrets] = useState<Record<string, string>>({
    OPENAI_API_KEY: "",
    ANTHROPIC_API_KEY: "",
    GOOGLE_API_KEY: "",
  });
  const [showTriggerPicker, setShowTriggerPicker] = useState(false);
  const [showBuildWithAIModal, setShowBuildWithAIModal] = useState(false);
  const [buildWithAIPrompt, setBuildWithAIPrompt] = useState("");
  const [nextStepSourceNodeId, setNextStepSourceNodeId] = useState<string | null>(null);
  const [nextStepBetween, setNextStepBetween] = useState<{
    edgeId: string;
    sourceId: string;
    targetId: string;
  } | null>(null);
  const [lastSuggestion, setLastSuggestion] = useState<WorkflowSuggestion | null>(null);
  const [aiTweakNotes, setAiTweakNotes] = useState("");

  const isEmptyCanvas = nodes.length === 0;
  const collabEnabled = process.env.NEXT_PUBLIC_ENABLE_LIVEBLOCKS === "true";
  const publishPresence = useCollaborationPresence();
  const updatePresence = useCallback(
    (pos: { x: number; y: number } | null, nodeId: string | null) => {
      publishPresence(pos, nodeId);
    },
    [publishPresence],
  );

  const selectedNode = useMemo(() => {
    if (!selectedNodeId) return null;
    const node = nodes.find((n) => n.id === selectedNodeId);
    return node
      ? { id: node.id, type: node.type as ForgeNodeType, data: node.data as ForgeNodeData }
      : null;
  }, [nodes, selectedNodeId]);

  useEffect(() => {
    setResolvedGraphId(graphId);
  }, [graphId]);

  useEffect(() => {
    let isMounted = true;
    async function loadGraph() {
      const { replaceGraph: replace, resetGraph: reset, markSaved: markSavedState } =
        useGraphStore.getState();

      if (graphId === "new") {
        if (templateQuery) {
          const template = getTemplateById(templateQuery);
          if (template) {
            replace(structuredClone(template.nodes), structuredClone(template.edges));
          } else {
            reset();
          }
        } else {
          reset();
        }
        reactFlowRef.current.setViewport(TEMPLATE_DEFAULT_VIEWPORT);
        setSaveError(null);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        const graph = await getGraph(graphId);
        if (!isMounted) return;
        replace(graph.json_content.nodes, graph.json_content.edges);
        reactFlowRef.current.setViewport(graph.json_content.viewport);
        setResolvedGraphId(graph.id);
        markSavedState();
      } catch {
        if (!isMounted) return;
        setSaveError("Failed to load graph.");
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    void loadGraph();
    return () => {
      isMounted = false;
    };
  }, [graphId, templateQuery]);

  function handleNodesChange(changes: Parameters<typeof onNodesChange>[0]) {
    const shouldSnapshot = changes.some((change) =>
      ["add", "remove", "replace"].includes(change.type),
    );
    if (shouldSnapshot) {
      pushHistory();
    }
    onNodesChange(changes);
  }

  function handleEdgesChange(changes: EdgeChange[]) {
    const shouldSnapshot = changes.some((change) =>
      ["add", "remove", "replace"].includes(change.type),
    );
    if (shouldSnapshot) {
      pushHistory();
    }
    onEdgesChange(changes);
  }

  function handleConnect(connection: Parameters<typeof onConnect>[0]) {
    pushHistory();
    onConnect(connection);
  }

  useEffect(() => {
    if (!isDirty || isLoading) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);

    saveTimerRef.current = setTimeout(async () => {
      setIsSaving(true);
      setSaveError(null);
      try {
        const viewport = reactFlow.getViewport();
        const payload = {
          title: "Untitled Graph",
          json_content: {
            version: 1,
            nodes,
            edges,
            viewport,
          },
        };

        if (resolvedGraphId === "new") {
          const created = await createGraph(payload);
          if (collabEnabled) {
            stashDraftGraphForNewRoom(created.id, {
              nodesJson: JSON.stringify(nodes),
              edgesJson: JSON.stringify(edges),
              v: Date.now(),
            });
          }
          setResolvedGraphId(created.id);
          router.replace(`/canvas/${created.id}`);
        } else {
          await updateGraph(resolvedGraphId, payload);
        }
        markSaved();
      } catch {
        setSaveError("Autosave failed. Check API/auth setup.");
      } finally {
        setIsSaving(false);
      }
    }, 2000);

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [
    collabEnabled,
    edges,
    isDirty,
    isLoading,
    markSaved,
    nodes,
    reactFlow,
    resolvedGraphId,
    router,
  ]);

  const addNode = (nodeType: ForgeNodeType) => {
    pushHistory();
    const id = crypto.randomUUID();
    const position = {
      x: 200 + Math.random() * 200,
      y: 100 + Math.random() * 200,
    };
    setNodes([
      ...nodes,
      {
        id,
        type: nodeType,
        position,
        data: { label: nodeType.replaceAll("_", " "), config: {} },
      },
    ]);
    setSelectedNodeId(id);
  };

  const updateNodeConfig = (nodeId: string, partialConfig: Record<string, unknown>) => {
    setNodes(
      nodes.map((node) => {
        if (node.id !== nodeId) return node;
        const data = node.data as ForgeNodeData;
        return {
          ...node,
          data: {
            ...data,
            config: partialConfig,
          },
        };
      }),
    );
  };

  function getSecretsPayload(): Record<string, string> {
    const out: Record<string, string> = {};
    if (runSecrets.OPENAI_API_KEY?.trim()) out.OPENAI_API_KEY = runSecrets.OPENAI_API_KEY.trim();
    if (runSecrets.ANTHROPIC_API_KEY?.trim()) out.ANTHROPIC_API_KEY = runSecrets.ANTHROPIC_API_KEY.trim();
    if (runSecrets.GOOGLE_API_KEY?.trim()) out.GOOGLE_API_KEY = runSecrets.GOOGLE_API_KEY.trim();
    return out;
  }

  async function runGraph() {
    setSaveError(null);
    if (resolvedGraphId === "new") {
      setSaveError("Save the graph first, then run execution.");
      return;
    }
    try {
      await startExecution(resolvedGraphId, {}, getSecretsPayload());
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to start execution";
      setSaveError(message);
    }
  }

  const deleteNode = (nodeId: string) => {
    pushHistory();
    setNodes(nodes.filter((n) => n.id !== nodeId));
    setEdges(edges.filter((e) => e.source !== nodeId && e.target !== nodeId));
    if (selectedNodeId === nodeId) setSelectedNodeId(null);
  };

  async function testSelectedNode() {
    setSaveError(null);
    if (resolvedGraphId === "new") {
      setSaveError("Save the graph first, then test a node.");
      return;
    }
    if (!selectedNodeId) {
      setSaveError("Select a node first.");
      return;
    }
    try {
      await startExecution(resolvedGraphId, { mode: "node_test", target_node_id: selectedNodeId });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to test node";
      setSaveError(message);
    }
  }

  async function runSelectedBranch() {
    setSaveError(null);
    if (resolvedGraphId === "new") {
      setSaveError("Save the graph first, then run a branch.");
      return;
    }
    if (!selectedNodeId) {
      setSaveError("Select a node to anchor branch run.");
      return;
    }
    try {
      await startExecution(resolvedGraphId, {
        mode: "branch_run",
        branch_root_node_id: selectedNodeId,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to run branch";
      setSaveError(message);
    }
  }

  async function applyAiSuggestion() {
    const prompt = aiPrompt.trim();
    if (!prompt) {
      setSaveError("Enter a workflow prompt first.");
      return;
    }

    setSaveError(null);
    setIsSuggesting(true);
    try {
      const suggestion = await suggestWorkflow(prompt);
      pushHistory();

      const idMap = new Map<string, string>();
      const remappedNodes = suggestion.nodes.map((node) => {
        const newId = crypto.randomUUID();
        idMap.set(node.id, newId);
        return {
          ...node,
          id: newId,
          position: {
            x: (node.position?.x ?? 200) + 80,
            y: (node.position?.y ?? 120) + 80,
          },
        };
      });
      const remappedEdges = suggestion.edges.map((edge) => ({
        ...edge,
        id: crypto.randomUUID(),
        source: idMap.get(edge.source) ?? edge.source,
        target: idMap.get(edge.target) ?? edge.target,
      }));

      setNodes([...nodes, ...remappedNodes]);
      setEdges([...edges, ...remappedEdges]);
      setSelectedNodeId(remappedNodes[0]?.id ?? null);
      setAiPrompt("");
      setLastSuggestion(suggestion);
      void logSuggestionTelemetry({
        event_type: "applied",
        template_id: suggestion.template_id,
        template_name: suggestion.template_name,
        prompt,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to generate workflow suggestion";
      setSaveError(message);
    } finally {
      setIsSuggesting(false);
    }
  }

  const addNodeAfter = (sourceNodeId: string, nodeType: ForgeNodeType) => {
    pushHistory();
    const source = nodes.find((n) => n.id === sourceNodeId);
    const id = crypto.randomUUID();
    const position = source
      ? { x: (source.position?.x ?? 0) + 220, y: source.position?.y ?? 120 }
      : { x: 200, y: 120 };
    setNodes([
      ...nodes,
      {
        id,
        type: nodeType,
        position,
        data: { label: nodeType.replaceAll("_", " "), config: {} },
      },
    ]);
    setEdges([...edges, { id: crypto.randomUUID(), source: sourceNodeId, target: id }]);
    setSelectedNodeId(id);
    setNextStepSourceNodeId(null);
  };

  const addNodeBetween = (
    edgeId: string,
    sourceId: string,
    targetId: string,
    nodeType: ForgeNodeType,
  ) => {
    pushHistory();
    const source = nodes.find((n) => n.id === sourceId);
    const target = nodes.find((n) => n.id === targetId);
    const id = crypto.randomUUID();
    const position = {
      x: ((source?.position?.x ?? 0) + (target?.position?.x ?? 400)) / 2,
      y: ((source?.position?.y ?? 0) + (target?.position?.y ?? 200)) / 2,
    };
    setNodes([
      ...nodes,
      {
        id,
        type: nodeType,
        position,
        data: { label: nodeType.replaceAll("_", " "), config: {} },
      },
    ]);
    setEdges([
      ...edges.filter((e) => e.id !== edgeId),
      { id: crypto.randomUUID(), source: sourceId, target: id },
      { id: crypto.randomUUID(), source: id, target: targetId },
    ]);
    setNextStepBetween(null);
    setSelectedNodeId(id);
  };

  const addMcpToolFromSearch = (tool: {
    name: string;
    description?: string;
    server_url?: string;
  }) => {
    pushHistory();
    const id = crypto.randomUUID();
    const position = { x: 240 + Math.random() * 120, y: 160 + Math.random() * 120 };
    setNodes([
      ...nodes,
      {
        id,
        type: "mcp_tool",
        position,
        data: {
          label: tool.name,
          config: {
            tool_name: tool.name,
            description: tool.description,
            server_url: tool.server_url,
          },
        },
      },
    ]);
    setSelectedNodeId(id);
    setShowMcpSearch(false);
  };

  async function regenerateAiSuggestion() {
    if (!lastSuggestion?.template_id) return;
    setSaveError(null);
    setIsRegenerating(true);
    try {
      const parts = [
        lastSuggestion.template_name ?? lastSuggestion.template_id,
        lastSuggestion.parameters ? JSON.stringify(lastSuggestion.parameters) : "",
        aiTweakNotes.trim() ? `Tweaks: ${aiTweakNotes.trim()}` : "",
      ].filter(Boolean);
      const suggestion = await suggestWorkflow(parts.join("\n"));
      pushHistory();
      const idMap = new Map<string, string>();
      const remappedNodes = suggestion.nodes.map((node) => {
        const newId = crypto.randomUUID();
        idMap.set(node.id, newId);
        return {
          ...node,
          id: newId,
          position: {
            x: (node.position?.x ?? 200) + 80,
            y: (node.position?.y ?? 120) + 80,
          },
        };
      });
      const remappedEdges = suggestion.edges.map((edge) => ({
        ...edge,
        id: crypto.randomUUID(),
        source: idMap.get(edge.source) ?? edge.source,
        target: idMap.get(edge.target) ?? edge.target,
      }));
      setNodes([...nodes, ...remappedNodes]);
      setEdges([...edges, ...remappedEdges]);
      setSelectedNodeId(remappedNodes[0]?.id ?? null);
      setLastSuggestion(suggestion);
      void logSuggestionTelemetry({
        event_type: "regenerated",
        template_id: suggestion.template_id,
        template_name: suggestion.template_name,
        prompt: parts.join("\n"),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to regenerate suggestion";
      setSaveError(message);
    } finally {
      setIsRegenerating(false);
    }
  }

  const canvasActions = useMemo(
    () => ({
      onTestNode: (nodeId: string) => {
        void (async () => {
          setSaveError(null);
          if (resolvedGraphId === "new") {
            setSaveError("Save the graph first, then test a node.");
            return;
          }
          try {
            await startExecution(resolvedGraphId, {
              mode: "node_test",
              target_node_id: nodeId,
            });
          } catch (error) {
            const message = error instanceof Error ? error.message : "Failed to test node";
            setSaveError(message);
          }
        })();
      },
      onDeleteNode: deleteNode,
      onToggleDisabled: (nodeId: string) => {
        pushHistory();
        setNodes(
          nodes.map((n) => {
            if (n.id !== nodeId) return n;
            const d = n.data as Record<string, unknown>;
            return { ...n, data: { ...n.data, disabled: !Boolean(d.disabled) } };
          }),
        );
      },
      onAddNextNode: (sourceNodeId: string) => setNextStepSourceNodeId(sourceNodeId),
      onAddBetween: (edgeId: string, sourceId: string, targetId: string) =>
        setNextStepBetween({ edgeId, sourceId, targetId }),
      canRun: !isRunning && resolvedGraphId !== "new",
    }),
    [deleteNode, isRunning, nodes, pushHistory, resolvedGraphId, setNodes, startExecution],
  );

  if (isLoading) {
    return <div className="flex h-screen items-center justify-center">Loading canvas...</div>;
  }

  const canvasTree = (
    <CanvasActionsProvider value={canvasActions}>
    <div className="flex h-screen w-full flex-col bg-zinc-950 text-zinc-100">
      <div className="flex flex-1 min-h-0">
        {/* Left navigation rail (replaces always-open node palette) */}
        <aside className="flex w-52 flex-col border-r border-zinc-900 bg-zinc-950/95">
          <div className="flex items-center gap-2 px-4 py-4">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-emerald-500 text-[10px] font-bold text-emerald-950">
              FG
            </div>
            <span className="text-sm font-semibold text-zinc-100">Forge</span>
          </div>
          <nav className="flex-1 space-y-1 px-2 text-sm">
            <Link
              href="/dashboard"
              className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-zinc-100 hover:bg-zinc-900"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              <span>Overview</span>
            </Link>
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-zinc-300 hover:bg-zinc-900"
              onClick={() => router.push("/canvas/new")}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-zinc-500" />
              <span>Personal</span>
            </button>
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-zinc-300 hover:bg-zinc-900"
              onClick={() => setShowBuildWithAIModal(true)}
            >
              <span className="flex h-4 items-center justify-center rounded-full bg-zinc-800 px-1 text-[10px] uppercase text-zinc-200">
                Chat
              </span>
              <span className="text-[10px] font-medium text-emerald-400">beta</span>
            </button>
          </nav>
          <div className="space-y-1 border-t border-zinc-900 px-2 py-3 text-sm">
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-left text-zinc-300 hover:bg-zinc-900"
              onClick={() => router.push("/admin")}
            >
              <span>Admin Panel</span>
            </button>
            <Link
              href="/templates"
              className="flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-left text-zinc-300 hover:bg-zinc-900"
            >
              <span>Templates</span>
            </Link>
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-left text-zinc-300 hover:bg-zinc-900"
              onClick={() => router.push("/insights")}
            >
              <span>Insights</span>
            </button>
            <Link
              href="/help"
              className="flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-left text-zinc-300 hover:bg-zinc-900"
            >
              <span>Help</span>
            </Link>
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-left text-zinc-300 hover:bg-zinc-900"
              onClick={() => router.push("/settings")}
            >
              <span>Settings</span>
            </button>
          </div>
        </aside>

        <div
        className="relative flex-1"
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          updatePresence({ x: e.clientX - rect.left, y: e.clientY - rect.top }, selectedNodeId);
        }}
        onMouseLeave={() => updatePresence(null, selectedNodeId)}
      >
        {collabEnabled && <CollaborationCursorsLive />}
        {isEmptyCanvas && (
          <EmptyCanvasState
            onAddFirstStep={() => setShowTriggerPicker(true)}
            onBuildWithAI={() => setShowBuildWithAIModal(true)}
          />
        )}

        {/* Top canvas header: breadcrumb + tabs + controls */}
        <div className="absolute left-0 right-0 top-0 z-10 flex h-12 items-center justify-between border-b border-zinc-900 bg-zinc-950/95 px-4 text-xs">
          <div className="flex items-center gap-2 text-zinc-400">
            <span className="text-zinc-500">Personal</span>
            <span>/</span>
            <span className="text-zinc-100">Untitled workflow</span>
          </div>
          <div className="flex items-center gap-1 rounded-md bg-zinc-900 p-1">
            {[
              { id: "editor" as const, label: "Editor" },
              { id: "executions" as const, label: "Executions" },
              { id: "evaluations" as const, label: "Evaluations" },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveCanvasTab(tab.id)}
                className={`px-3 py-1 text-[11px] font-medium ${
                  activeCanvasTab === tab.id
                    ? "rounded-md bg-zinc-100 text-zinc-900"
                    : "rounded-md text-zinc-400 hover:bg-zinc-800"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 text-[11px] text-zinc-300">
            <span className="rounded-full bg-zinc-900 px-2 py-1 text-zinc-400">0 / 1</span>
            <button
              type="button"
              className="rounded-md bg-zinc-900 px-3 py-1 text-zinc-200 hover:bg-zinc-800"
              onClick={() => setShowRunSettings((s) => !s)}
            >
              API keys
            </button>
            <button
              type="button"
              className="rounded-md bg-zinc-900 px-3 py-1 text-zinc-200 hover:bg-zinc-800"
            >
              Publish
            </button>
          </div>
        </div>
        {saveError && (
          <div className="absolute left-0 right-0 top-12 z-20 px-4">
            <ErrorAlert message={saveError} onDismiss={() => setSaveError(null)} />
          </div>
        )}
        {/* Compact canvas controls — n8n-style icon buttons (bottom-left) */}
        <div className="absolute left-3 bottom-[76px] z-20 flex gap-1 rounded-md border border-zinc-800 bg-zinc-900/90 px-1 py-1 text-xs">
          <button
            type="button"
            onClick={undo}
            disabled={!canUndo}
            title="Undo"
            className="flex h-8 w-8 items-center justify-center rounded-md bg-zinc-900 text-zinc-200 hover:bg-zinc-800 disabled:text-zinc-600 disabled:hover:bg-zinc-900"
          >
            Undo
          </button>
          <Button
            variant="outline"
            onClick={runGraph}
            disabled={isRunning || isSaving || resolvedGraphId === "new"}
          >
            Run Full
          </Button>
          <Button
            variant="outline"
            onClick={testSelectedNode}
            disabled={isRunning || isSaving || !selectedNodeId || resolvedGraphId === "new"}
          >
            Test Node
          </Button>
          <Button
            variant="outline"
            onClick={runSelectedBranch}
            disabled={isRunning || isSaving || !selectedNodeId || resolvedGraphId === "new"}
          >
            Run Branch
          </Button>
          <Button variant="outline" onClick={() => void cancelExecution()} disabled={!isRunning}>
            Cancel
          </Button>
          <Input
            value={aiPrompt}
            onChange={(e) => setAiPrompt(e.target.value)}
            placeholder="Describe workflow to generate..."
            className="h-9 w-64"
          />
          <Button
            variant="outline"
            onClick={applyAiSuggestion}
            disabled={isRunning || isSaving || isSuggesting}
          >
            <Maximize2 className="h-4 w-4" />
          </Button>
        </div>
        <div className="absolute right-6 bottom-6 z-20 flex items-center gap-3">
          <button
            type="button"
            onClick={runGraph}
            disabled={isRunning || isSaving || resolvedGraphId === "new"}
            className="rounded-md bg-red-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-red-500 disabled:cursor-not-allowed disabled:bg-red-900"
          >
            Execute workflow
          </button>
        </div>
        {showRunSettings && (
          <div className="absolute left-3 top-12 z-20 flex flex-wrap items-end gap-3 rounded-md border border-zinc-800 bg-zinc-900/95 p-3 text-xs">
            <span className="w-full text-[11px] font-medium text-zinc-400">
              API keys (used when you run; not stored)
            </span>
            <div className="flex flex-col gap-1">
              <label htmlFor="run-openai-key" className="text-zinc-400">
                OpenAI (GPT)
              </label>
              <Input
                id="run-openai-key"
                type="password"
                placeholder="sk-..."
                value={runSecrets.OPENAI_API_KEY}
                onChange={(e) =>
                  setRunSecrets((s) => ({ ...s, OPENAI_API_KEY: e.target.value }))
                }
                className="h-8 w-56 font-mono text-[11px]"
                autoComplete="off"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="run-anthropic-key" className="text-zinc-400">
                Anthropic (Claude)
              </label>
              <Input
                id="run-anthropic-key"
                type="password"
                placeholder="sk-ant-..."
                value={runSecrets.ANTHROPIC_API_KEY}
                onChange={(e) =>
                  setRunSecrets((s) => ({ ...s, ANTHROPIC_API_KEY: e.target.value }))
                }
                className="h-8 w-56 font-mono text-[11px]"
                autoComplete="off"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="run-google-key" className="text-zinc-400">
                Google (Gemini)
              </label>
              <Input
                id="run-google-key"
                type="password"
                placeholder="..."
                value={runSecrets.GOOGLE_API_KEY}
                onChange={(e) =>
                  setRunSecrets((s) => ({ ...s, GOOGLE_API_KEY: e.target.value }))
                }
                className="h-8 w-56 font-mono text-[11px]"
                autoComplete="off"
              />
            </div>
          </div>
        )}
        {showNodePalette && (
          <div className="absolute left-16 top-16 z-30 h-[520px] w-[320px] rounded-lg border border-zinc-800 bg-zinc-950 shadow-xl">
            <NodePalette
              onAddNode={(nodeType) => {
                addNode(nodeType);
                setShowNodePalette(false);
              }}
            />
          </div>
        )}
        {lastSuggestion && lastSuggestion.template_id && (
          <div className="absolute right-3 top-16 z-20 max-w-sm rounded-md border border-emerald-600/60 bg-zinc-900/95 p-3 text-xs text-zinc-100 shadow-lg">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div>
                <div className="text-[11px] uppercase tracking-wide text-emerald-400">
                  AI Template
                </div>
                <div className="text-sm font-semibold">
                  {lastSuggestion.template_name ?? lastSuggestion.template_id}
                </div>
              </div>
              <span className="rounded bg-emerald-900/60 px-2 py-1 text-[10px] text-emerald-200">
                {lastSuggestion.template_id}
              </span>
            </div>
            {lastSuggestion.parameters && (
              <div className="mb-2">
                <div className="mb-1 text-[11px] font-medium text-zinc-300">
                  Key parameters
                </div>
                <pre className="max-h-32 overflow-auto rounded bg-zinc-950/80 p-2 text-[10px] text-zinc-200">
                  {JSON.stringify(lastSuggestion.parameters, null, 2)}
                </pre>
              </div>
            )}
            <div className="mb-2">
              <label className="mb-1 block text-[11px] font-medium text-zinc-300">
                Tweaks for regenerate
              </label>
              <textarea
                value={aiTweakNotes}
                onChange={(e) => setAiTweakNotes(e.target.value)}
                placeholder="Example: change time to 9am, send to ops@company.com"
                className="min-h-[56px] w-full resize-y rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1 text-[11px] text-zinc-100 outline-none focus:border-emerald-500"
              />
            </div>
            <Button
              variant="outline"
              className="h-9 w-full border-emerald-600 text-emerald-200 hover:bg-emerald-900/40"
              onClick={() => void regenerateAiSuggestion()}
              disabled={isRunning || isSaving || isRegenerating}
            >
              {isRegenerating ? "Regenerating..." : "Regenerate with tweaks"}
            </Button>
          </div>
        )}

        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={handleNodesChange}
          onEdgesChange={handleEdgesChange}
          onConnect={handleConnect}
          onNodeClick={(_, node) => {
            setSelectedNodeId(node.id);
            updatePresence(null, node.id);
          }}
          onNodeDragStart={() => {
            if (!dragSnapshotRef.current) {
              pushHistory();
              dragSnapshotRef.current = true;
            }
          }}
          onNodeDragStop={() => {
            dragSnapshotRef.current = false;
          }}
          onSelectionDragStart={() => {
            if (!dragSnapshotRef.current) {
              pushHistory();
              dragSnapshotRef.current = true;
            }
          }}
          onSelectionDragStop={() => {
            dragSnapshotRef.current = false;
          }}
          fitView
          className="bg-zinc-950"
        >
          <Background gap={18} size={1} />
          <Controls />
          <MiniMap pannable zoomable />
        </ReactFlow>
        {showMcpSearch && (
          <div className="absolute right-3 top-16 z-30 h-[420px] w-[340px] rounded-lg border border-zinc-800 bg-zinc-950 shadow-xl">
            <MCPSearchPanel onAddToCanvas={(tool) => addMcpToolFromSearch(tool)} />
          </div>
        )}
        {showTriggerPicker && (
          <TriggerPickerOverlay
            onSelect={(nodeType) => addNode(nodeType)}
            onClose={() => setShowTriggerPicker(false)}
          />
        )}
        {nextStepSourceNodeId && (
          <NextStepPicker
            onSelect={(nodeType) => addNodeAfter(nextStepSourceNodeId, nodeType)}
            onClose={() => setNextStepSourceNodeId(null)}
          />
        )}
        {nextStepBetween && (
          <NextStepPicker
            onSelect={(nodeType) => {
              addNodeBetween(
                nextStepBetween.edgeId,
                nextStepBetween.sourceId,
                nextStepBetween.targetId,
                nodeType,
              );
            }}
            onClose={() => setNextStepBetween(null)}
          />
        )}
        {showBuildWithAIModal && (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/60">
            <div className="w-full max-w-md rounded-lg border border-zinc-800 bg-zinc-900 p-4 shadow-xl">
              <h3 className="text-sm font-semibold text-zinc-100">Build with AI</h3>
              <p className="mt-1 text-xs text-zinc-400">
                Describe the workflow you want and we&apos;ll generate the steps.
              </p>
              <textarea
                value={buildWithAIPrompt}
                onChange={(e) => setBuildWithAIPrompt(e.target.value)}
                placeholder="e.g. When form is submitted, call an LLM and send the result to Slack"
                className="mt-3 h-24 w-full resize-none rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-600"
                rows={4}
              />
              <div className="mt-4 flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowBuildWithAIModal(false);
                    setBuildWithAIPrompt("");
                  }}
                >
                  Cancel
                </Button>
                <Button
                  disabled={isSuggesting || !buildWithAIPrompt.trim()}
                  onClick={async () => {
                    const promptText = buildWithAIPrompt.trim();
                    setShowBuildWithAIModal(false);
                    setBuildWithAIPrompt("");
                    if (!promptText) return;
                    setSaveError(null);
                    setIsSuggesting(true);
                    try {
                      const suggestion = await suggestWorkflow(promptText);
                      pushHistory();
                      const idMap = new Map<string, string>();
                      const remappedNodes = suggestion.nodes.map((node) => {
                        const newId = crypto.randomUUID();
                        idMap.set(node.id, newId);
                        return {
                          ...node,
                          id: newId,
                          position: {
                            x: (node.position?.x ?? 200) + 80,
                            y: (node.position?.y ?? 120) + 80,
                          },
                        };
                      });
                      const remappedEdges = suggestion.edges.map((edge) => ({
                        ...edge,
                        id: crypto.randomUUID(),
                        source: idMap.get(edge.source) ?? edge.source,
                        target: idMap.get(edge.target) ?? edge.target,
                      }));
                      setNodes([...nodes, ...remappedNodes]);
                      setEdges([...edges, ...remappedEdges]);
                      setSelectedNodeId(remappedNodes[0]?.id ?? null);
                      setLastSuggestion(suggestion);
                      void logSuggestionTelemetry({
                        event_type: "applied",
                        template_id: suggestion.template_id,
                        template_name: suggestion.template_name,
                        prompt: promptText,
                      });
                    } catch (err) {
                      const message =
                        err instanceof Error ? err.message : "Failed to generate workflow";
                      setSaveError(message);
                    } finally {
                      setIsSuggesting(false);
                    }
                  }}
                >
                  {isSuggesting ? "Generating..." : "Generate"}
                </Button>
              </div>
            </div>
          </div>
        )}
        {showDeploy && (
          <DeployModal
            graphId={resolvedGraphId}
            graphTitle="Workflow"
            onClose={() => setShowDeploy(false)}
          />
        )}
        {/* Node config drawer – only visible when a node is selected */}
        {selectedNode && (
          <div className="absolute right-3 top-16 z-30 h-[520px] w-[360px] rounded-lg border border-zinc-800 bg-zinc-950 shadow-xl">
            <div className="flex items-center justify-between border-b border-zinc-800 px-3 py-2 text-xs">
              <span className="font-semibold text-zinc-200">
                {selectedNode.data.label}
              </span>
              <button
                type="button"
                className="rounded px-2 py-0.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
                onClick={() => setSelectedNodeId(null)}
              >
                ✕
              </button>
            </div>
            <div className="h-[calc(100%-32px)] overflow-y-auto">
              <NodeConfigPanel selectedNode={selectedNode} onUpdateNodeConfig={updateNodeConfig} />
            </div>
          </div>
        )}
        </div>
      </div>

      {/* Bottom-aligned execution logs, spanning full width */}
      <div className="h-20 min-h-[72px] border-t border-zinc-900 bg-zinc-950">
        <ExecutionLogPanel
          events={events}
          tokenStreams={tokenStreams}
          nodeStatuses={nodeStatuses}
          isRunning={isRunning}
          error={executionError}
          onApprove={(approved, feedback) => void approveStep(approved, feedback)}
        />
      </div>
    </div>
    </CanvasActionsProvider>
  );

  if (collabEnabled) {
    return (
      <CollaborativeRoom key={resolvedGraphId} roomId={`forge:${resolvedGraphId}`}>
        {canvasTree}
      </CollaborativeRoom>
    );
  }

  return canvasTree;
}

export function FlowCanvas({ graphId }: { graphId: string }) {
  return (
    <ReactFlowProvider>
      <CanvasContent graphId={graphId} />
    </ReactFlowProvider>
  );
}
