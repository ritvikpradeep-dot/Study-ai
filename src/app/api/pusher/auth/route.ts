import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { authorizeTeamChannel, isPusherConfigured } from "@/lib/pusher-server";

// Pusher's client SDK POSTs here (application/x-www-form-urlencoded) whenever
// it needs to subscribe to a private-* channel. We only sign the request if
// the requesting user is actually a member of the team the channel name
// encodes — this is the real access-control boundary, not the channel name
// itself (anyone could guess a teamId).
export async function POST(request: Request) {
  if (!isPusherConfigured()) {
    return NextResponse.json({ error: "Realtime isn't configured." }, { status: 503 });
  }

  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const form = await request.formData();
  const socketId = String(form.get("socket_id") ?? "");
  const channelName = String(form.get("channel_name") ?? "");

  const match = /^private-team-(.+)$/.exec(channelName);
  if (!socketId || !match) {
    return NextResponse.json({ error: "Invalid channel." }, { status: 400 });
  }
  const teamId = match[1];

  const membership = await prisma.teamMember.findUnique({
    where: { teamId_userId: { teamId, userId: session.user.id } },
  });
  // Admins can silently observe any room's live channel (cursors, stroke
  // previews, activity) without joining it — no TeamMember row is created,
  // so they never appear in the member list or trigger member-joined.
  if (!membership && session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const authResponse = authorizeTeamChannel(socketId, channelName);
  return NextResponse.json(authResponse);
}
