/**
 * Zod schemas for the Forge graph/workflow data model.
 * Represents the JSON stored in graphs.json_content (Supabase JSONB).
 */
import { z } from "zod";
import { NodeTypeSchema } from "./nodes.js";

// ---------------------------------------------------------------------------
// Node position (React Flow XYPosition)
// ---------------------------------------------------------------------------

export const PositionSchema = z.object({
  x: z.number(),
  y: z.number(),
});

// ---------------------------------------------------------------------------
// Canvas node (React Flow node + Forge config payload)
// ---------------------------------------------------------------------------

export const CanvasNodeSchema = z.object({
  id: z.string().uuid(),
  type: NodeTypeSchema,
  position: PositionSchema,
  data: z
    .object({
      label: z.string().min(1).max(128),
      config: z.record(z.unknown()).default({}),
    })
    .passthrough(),
  measured: z
    .object({
      width: z.number().optional(),
      height: z.number().optional(),
    })
    .optional(),
  selected: z.boolean().optional(),
  dragging: z.boolean().optional(),
});

export type CanvasNode = z.infer<typeof CanvasNodeSchema>;

// ---------------------------------------------------------------------------
// Canvas edge (React Flow edge)
// ---------------------------------------------------------------------------

export const CanvasEdgeSchema = z.object({
  id: z.string(),
  source: z.string().uuid(),
  target: z.string().uuid(),
  sourceHandle: z.string().optional(),
  targetHandle: z.string().optional(),
  label: z.string().optional(),
  animated: z.boolean().optional(),
});

export type CanvasEdge = z.infer<typeof CanvasEdgeSchema>;

// ---------------------------------------------------------------------------
// Graph viewport
// ---------------------------------------------------------------------------

export const ViewportSchema = z.object({
  x: z.number().default(0),
  y: z.number().default(0),
  zoom: z.number().min(0.1).max(4).default(1),
});

// ---------------------------------------------------------------------------
// Full graph JSON content (stored as jsonb in Supabase)
// Total size must be ≤ 4MB (Supabase row size limit)
// ---------------------------------------------------------------------------

export const GraphContentSchema = z.object({
  version: z.number().int().positive().default(1),
  nodes: z.array(CanvasNodeSchema).max(500),
  edges: z.array(CanvasEdgeSchema).max(1000),
  viewport: ViewportSchema.default({}),
});

export type GraphContent = z.infer<typeof GraphContentSchema>;

// ---------------------------------------------------------------------------
// Graph metadata (mirrors the Supabase graphs table)
// ---------------------------------------------------------------------------

export const GraphMetadataSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  title: z.string().min(1).max(128),
  description: z.string().max(512).optional(),
  version: z.number().int().positive().default(1),
  is_public: z.boolean().default(false),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export type GraphMetadata = z.infer<typeof GraphMetadataSchema>;

// ---------------------------------------------------------------------------
// Create / Update DTOs
// ---------------------------------------------------------------------------

export const CreateGraphSchema = z.object({
  title: z.string().min(1).max(128),
  description: z.string().max(512).optional(),
  json_content: GraphContentSchema.default({
    version: 1,
    nodes: [],
    edges: [],
    viewport: { x: 0, y: 0, zoom: 1 },
  }),
});

export type CreateGraph = z.infer<typeof CreateGraphSchema>;

export const UpdateGraphSchema = z.object({
  title: z.string().min(1).max(128).optional(),
  description: z.string().max(512).optional(),
  json_content: GraphContentSchema.optional(),
  is_public: z.boolean().optional(),
});

export type UpdateGraph = z.infer<typeof UpdateGraphSchema>;
