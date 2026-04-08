"use client";

import { addEdge, applyEdgeChanges, applyNodeChanges } from "@xyflow/react";
import type {
  Connection,
  Edge,
  EdgeChange,
  Node,
  NodeChange,
  OnConnect,
  OnEdgesChange,
  OnNodesChange,
} from "@xyflow/react";
import { create } from "zustand";

export type ForgeNodeType =
  | "manual_trigger"
  | "webhook_trigger"
  | "schedule_trigger"
  | "form_submission_trigger"
  | "app_event_trigger"
  | "ai_agent"
  | "llm_caller"
  | "simple_llm"
  | "rag_retriever"
  | "research"
  | "web_scrape"
  | "vision_extract"
  | "sql_query"
  | "loop"
  | "template_render"
  | "pdf_report"
  | "wait_callback"
  | "error_handler"
  | "conditional_branch"
  | "mcp_tool"
  | "action"
  | "http_request"
  | "set_node"
  | "approval_step"
  | "delay"
  | "json_parse"
  | "json_stringify"
  | "merge"
  | "filter";

export interface ForgeNodeData extends Record<string, unknown> {
  label: string;
  config: Record<string, unknown>;
}

export type ForgeNode = Node<ForgeNodeData>;

interface GraphStoreState {
  nodes: ForgeNode[];
  edges: Edge[];
  selectedNodeId: string | null;
  isDirty: boolean;
  canUndo: boolean;
  canRedo: boolean;
  undoStack: Array<{ nodes: ForgeNode[]; edges: Edge[] }>;
  redoStack: Array<{ nodes: ForgeNode[]; edges: Edge[] }>;
  setNodes: (nodes: ForgeNode[]) => void;
  setEdges: (edges: Edge[]) => void;
  setSelectedNodeId: (nodeId: string | null) => void;
  markSaved: () => void;
  onNodesChange: OnNodesChange<ForgeNode>;
  onEdgesChange: OnEdgesChange<Edge>;
  onConnect: OnConnect;
  pushHistory: () => void;
  undo: () => void;
  redo: () => void;
  replaceGraph: (nodes: ForgeNode[], edges: Edge[]) => void;
  resetGraph: () => void;
}

function cloneGraph(
  nodes: ForgeNode[],
  edges: Edge[],
): { nodes: ForgeNode[]; edges: Edge[] } {
  return {
    nodes: structuredClone(nodes),
    edges: structuredClone(edges),
  };
}

export const useGraphStore = create<GraphStoreState>((set, get) => ({
  nodes: [],
  edges: [],
  selectedNodeId: null,
  isDirty: false,
  canUndo: false,
  canRedo: false,
  undoStack: [],
  redoStack: [],

  setNodes: (nodes) => set({ nodes, isDirty: true }),
  setEdges: (edges) => set({ edges, isDirty: true }),
  setSelectedNodeId: (selectedNodeId) => set({ selectedNodeId }),
  markSaved: () => set({ isDirty: false }),

  onNodesChange: (changes: NodeChange<ForgeNode>[]) => {
    set((state) => ({
      nodes: applyNodeChanges(changes, state.nodes),
      isDirty: true,
    }));
  },

  onEdgesChange: (changes: EdgeChange<Edge>[]) => {
    set((state) => ({
      edges: applyEdgeChanges(changes, state.edges),
      isDirty: true,
    }));
  },

  onConnect: (connection: Connection) => {
    set((state) => ({
      edges: addEdge(connection, state.edges),
      isDirty: true,
    }));
  },

  pushHistory: () => {
    const { nodes, edges, undoStack } = get();
    const snapshot = cloneGraph(nodes, edges);
    const nextStack = [...undoStack, snapshot].slice(-50);
    set({
      undoStack: nextStack,
      redoStack: [],
      canUndo: nextStack.length > 0,
      canRedo: false,
    });
  },

  undo: () => {
    const { undoStack, redoStack, nodes, edges } = get();
    if (undoStack.length === 0) return;

    const previous = undoStack[undoStack.length - 1];
    if (!previous) return;
    const rest = undoStack.slice(0, -1);
    const current = cloneGraph(nodes, edges);
    const nextRedo = [...redoStack, current].slice(-50);

    set({
      nodes: previous.nodes,
      edges: previous.edges,
      undoStack: rest,
      redoStack: nextRedo,
      canUndo: rest.length > 0,
      canRedo: nextRedo.length > 0,
      isDirty: true,
    });
  },

  redo: () => {
    const { undoStack, redoStack, nodes, edges } = get();
    if (redoStack.length === 0) return;

    const next = redoStack[redoStack.length - 1];
    if (!next) return;
    const rest = redoStack.slice(0, -1);
    const current = cloneGraph(nodes, edges);
    const nextUndo = [...undoStack, current].slice(-50);

    set({
      nodes: next.nodes,
      edges: next.edges,
      redoStack: rest,
      undoStack: nextUndo,
      canUndo: nextUndo.length > 0,
      canRedo: rest.length > 0,
      isDirty: true,
    });
  },

  replaceGraph: (nodes, edges) =>
    set({
      nodes,
      edges,
      selectedNodeId: nodes[0]?.id ?? null,
      isDirty: false,
      undoStack: [],
      redoStack: [],
      canUndo: false,
      canRedo: false,
    }),

  resetGraph: () =>
    set({
      nodes: [],
      edges: [],
      selectedNodeId: null,
      isDirty: false,
      undoStack: [],
      redoStack: [],
      canUndo: false,
      canRedo: false,
    }),
}));
