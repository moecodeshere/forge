"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

import type { ForgeNodeType } from "@/lib/stores/graphStore";
import { Input } from "@/components/ui/input";
import {
  NODE_CATALOG,
  PALETTE_CATEGORIES,
  type NodeCatalogEntry,
  type NodeCategory,
  type PaletteFilterCategory,
} from "@/lib/nodes/catalog";

interface NodePaletteProps {
  onAddNode: (nodeType: ForgeNodeType) => void;
}

function NodeCard({
  node,
  onAddNode,
}: {
  node: NodeCatalogEntry;
  onAddNode: (type: ForgeNodeType) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onAddNode(node.type)}
      className="w-full rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 text-left transition hover:border-zinc-600 hover:bg-zinc-800"
    >
      <p className="text-sm font-medium text-zinc-100">{node.label}</p>
      <p className="text-xs text-zinc-400">
        {node.category}
        {node.beginnerFriendly ? " • Beginner" : ""}
      </p>
      <p className="mt-0.5 text-[11px] text-zinc-500 line-clamp-2">{node.shortDescription}</p>
    </button>
  );
}

export function NodePalette({ onAddNode }: NodePaletteProps) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<PaletteFilterCategory>("All");
  const [beginnerOnly, setBeginnerOnly] = useState(false);
  const [collapsedCategories, setCollapsedCategories] = useState<Set<NodeCategory>>(new Set());

  const filteredNodes = useMemo(() => {
    return NODE_CATALOG.filter((node) => {
      if (category !== "All" && node.category !== category) return false;
      if (beginnerOnly && !node.beginnerFriendly) return false;
      if (!search.trim()) return true;
      const q = search.trim().toLowerCase();
      return (
        node.label.toLowerCase().includes(q) ||
        node.category.toLowerCase().includes(q) ||
        node.shortDescription.toLowerCase().includes(q)
      );
    });
  }, [beginnerOnly, category, search]);

  const nodesByCategory = useMemo(() => {
    const map = new Map<NodeCategory, NodeCatalogEntry[]>();
    for (const node of filteredNodes) {
      const list = map.get(node.category) ?? [];
      list.push(node);
      map.set(node.category, list);
    }
    return map;
  }, [filteredNodes]);

  const toggleCategory = (cat: NodeCategory) => {
    setCollapsedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  const showCollapsible = category === "All" && !search.trim() && filteredNodes.length > 0;

  return (
    <aside className="w-72 border-r border-zinc-800 bg-zinc-950/90 p-4">
      <h2 className="mb-3 text-sm font-semibold text-zinc-200">Node Palette</h2>
      <div className="mb-3 space-y-2">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search nodes..."
        />
        <div className="flex flex-wrap gap-1">
          {PALETTE_CATEGORIES.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setCategory(option)}
              className={`rounded px-2 py-1 text-[11px] ${
                category === option
                  ? "bg-zinc-200 text-zinc-900"
                  : "bg-zinc-900 text-zinc-400 hover:bg-zinc-800"
              }`}
            >
              {option}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-xs text-zinc-400">
          <input
            type="checkbox"
            checked={beginnerOnly}
            onChange={(e) => setBeginnerOnly(e.target.checked)}
          />
          Beginner-friendly only
        </label>
      </div>
      <div className="space-y-2">
        {showCollapsible ? (
          Array.from(nodesByCategory.entries())
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([cat, nodesInCat]) => {
              const isCollapsed = collapsedCategories.has(cat);
              return (
                <div key={cat} className="rounded-md border border-zinc-800 bg-zinc-900/50">
                  <button
                    type="button"
                    onClick={() => toggleCategory(cat)}
                    className="flex w-full items-center gap-1 px-2 py-1.5 text-left text-xs font-medium text-zinc-300 hover:bg-zinc-800"
                  >
                    {isCollapsed ? (
                      <ChevronRight className="h-3.5 w-3.5" />
                    ) : (
                      <ChevronDown className="h-3.5 w-3.5" />
                    )}
                    {cat} ({nodesInCat.length})
                  </button>
                  {!isCollapsed && (
                    <div className="space-y-1 border-t border-zinc-800 p-2">
                      {nodesInCat.map((node) => (
                        <NodeCard key={node.type} node={node} onAddNode={onAddNode} />
                      ))}
                    </div>
                  )}
                </div>
              );
            })
        ) : (
          <>
            {filteredNodes.map((node) => (
              <NodeCard key={node.type} node={node} onAddNode={onAddNode} />
            ))}
            {filteredNodes.length === 0 && (
              <p className="rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs text-zinc-400">
                No nodes match this filter.
              </p>
            )}
          </>
        )}
      </div>
    </aside>
  );
}
