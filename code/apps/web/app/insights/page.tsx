"use client";

import Link from "next/link";
import { ArrowLeft, BarChart3 } from "lucide-react";

export default function InsightsPage() {
  return (
    <main className="min-h-screen bg-zinc-950 px-4 py-8 text-zinc-100 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-2xl">
        <Link
          href="/dashboard"
          className="mb-6 inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-zinc-200"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </Link>
        <h1 className="text-2xl font-semibold">Insights</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Run analytics and usage insights for your workflows. Coming soon.
        </p>
        <Link
          href="/dashboard"
          className="mt-6 inline-flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm font-medium text-zinc-200 hover:bg-zinc-800"
        >
          <BarChart3 className="h-4 w-4" />
          Go to Dashboard
        </Link>
      </div>
    </main>
  );
}
