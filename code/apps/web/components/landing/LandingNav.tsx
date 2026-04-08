"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";

export function LandingNav() {
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);

  useEffect(() => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );
    supabase.auth.getSession().then(({ data: { session } }) => {
      setIsLoggedIn(!!session);
    });
  }, []);

  return (
    <nav className="flex items-center justify-between border-b border-zinc-800 px-6 py-4">
      <Link href="/" className="flex items-center gap-2">
        <div className="size-7 rounded-md bg-gradient-to-br from-purple-500 to-blue-500" />
        <span className="text-lg font-semibold tracking-tight text-white">Forge</span>
      </Link>
      <div className="flex items-center gap-3">
        <Link
          href="/marketplace"
          className="text-sm text-zinc-400 transition-colors hover:text-white"
        >
          Marketplace
        </Link>
        {isLoggedIn ? (
          <Link
            href="/dashboard"
            className="rounded-md bg-white px-4 py-1.5 text-sm font-medium text-zinc-950 transition-colors hover:bg-zinc-100"
          >
            Dashboard
          </Link>
        ) : (
          <>
            <Link
              href="/login"
              className="text-sm text-zinc-400 transition-colors hover:text-white"
            >
              Sign in
            </Link>
            <Link
              href="/register"
              className="rounded-md bg-white px-4 py-1.5 text-sm font-medium text-zinc-950 transition-colors hover:bg-zinc-100"
            >
              Get started
            </Link>
          </>
        )}
      </div>
    </nav>
  );
}
