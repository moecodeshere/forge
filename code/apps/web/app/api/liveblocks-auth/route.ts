import { Liveblocks } from "@liveblocks/node";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { getServerSupabaseClient } from "@/lib/supabase-server";

const ROOM_PREFIX = "forge:";

function randomColor(): string {
  const colors = ["#22c55e", "#3b82f6", "#a855f7", "#f97316", "#ec4899", "#14b8a6"];
  return colors[Math.floor(Math.random() * colors.length)] ?? "#3b82f6";
}

/**
 * Issues short-lived Liveblocks session tokens. Verifies Supabase session and graph ownership.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.LIVEBLOCKS_SECRET_KEY;
  if (!secret?.trim()) {
    return NextResponse.json({ error: "Liveblocks not configured" }, { status: 503 });
  }

  let body: { room?: string };
  try {
    body = (await req.json()) as { room?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const room = body.room;
  if (!room || typeof room !== "string" || !room.startsWith(ROOM_PREFIX)) {
    return NextResponse.json({ error: "Invalid room" }, { status: 400 });
  }

  const graphId = room.slice(ROOM_PREFIX.length);
  if (!graphId) {
    return NextResponse.json({ error: "Invalid graph id" }, { status: 400 });
  }

  const supabase = await getServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Unsaved draft canvas — no `graphs` row yet; only authenticated session required.
  if (graphId !== "new") {
    if (graphId.length < 8) {
      return NextResponse.json({ error: "Invalid graph id" }, { status: 400 });
    }
    const { data: graph, error } = await supabase
      .from("graphs")
      .select("id")
      .eq("id", graphId)
      .maybeSingle();

    if (error || !graph) {
      return NextResponse.json({ error: "Graph not found" }, { status: 403 });
    }
  }

  const liveblocks = new Liveblocks({ secret });
  const session = liveblocks.prepareSession(user.id, {
    userInfo: {
      name: user.email ?? user.id.slice(0, 8),
      color: randomColor(),
    },
  });
  session.allow(room, session.FULL_ACCESS);
  const { status, body: responseBody } = await session.authorize();
  return new NextResponse(responseBody, { status });
}
