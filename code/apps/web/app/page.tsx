import Link from "next/link";
import { Zap, GitBranch, Cpu, Globe } from "lucide-react";
import { LandingNav } from "@/components/landing/LandingNav";

const features = [
  {
    icon: Zap,
    title: "Visual Workflow Builder",
    description:
      "Drag-and-drop AI nodes onto a canvas. Connect LLM calls, RAG retrievers, and MCP tools visually.",
  },
  {
    icon: Cpu,
    title: "LangGraph Execution",
    description:
      "Stateful, checkpointed execution with automatic retry, human-in-the-loop, and real-time token streaming.",
  },
  {
    icon: GitBranch,
    title: "MCP Ecosystem",
    description:
      "Search and connect any MCP tool — GitHub, Slack, databases, and thousands more from the registry.",
  },
  {
    icon: Globe,
    title: "One-Click Deploy",
    description:
      "Deploy to Forge Cloud, export as MCP server, download as Docker image, or export clean Python code.",
  },
];

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col bg-zinc-950 text-white">
      <LandingNav />

      {/* Hero */}
      <section className="flex flex-col items-center justify-center flex-1 px-4 py-24 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-zinc-700 bg-zinc-900 text-xs text-zinc-400 mb-6">
          <span className="size-1.5 rounded-full bg-green-400" />
          MCP-first • LangGraph-powered • Production-grade
        </div>
        <h1 className="text-5xl sm:text-7xl font-bold tracking-tight max-w-3xl bg-gradient-to-b from-white to-zinc-400 bg-clip-text text-transparent">
          Build AI Agents Visually
        </h1>
        <p className="mt-6 text-lg text-zinc-400 max-w-xl">
          Forge is a visual IDE for composing, testing, and deploying MCP-first
          agentic workflows — no code required. Deploy to Claude Desktop in
          minutes.
        </p>
        <div className="mt-8 flex items-center gap-4">
          <Link
            href="/register"
            className="px-6 py-3 bg-white text-zinc-950 rounded-lg font-semibold hover:bg-zinc-100 transition-colors text-sm"
          >
            Start building free
          </Link>
          <Link
            href="/marketplace"
            className="px-6 py-3 border border-zinc-700 rounded-lg font-semibold hover:border-zinc-500 transition-colors text-sm"
          >
            Browse marketplace
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="px-6 pb-24">
        <div className="max-w-4xl mx-auto grid grid-cols-1 sm:grid-cols-2 gap-4">
          {features.map(({ icon: Icon, title, description }) => (
            <div
              key={title}
              className="p-6 rounded-xl border border-zinc-800 bg-zinc-900/50 hover:border-zinc-600 transition-colors"
            >
              <Icon className="size-5 text-purple-400 mb-3" />
              <h3 className="font-semibold mb-1">{title}</h3>
              <p className="text-sm text-zinc-400 leading-relaxed">
                {description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-zinc-800 px-6 py-6 text-center text-xs text-zinc-600">
        © {new Date().getFullYear()} Forge AI Workflow Studio
      </footer>
    </main>
  );
}
