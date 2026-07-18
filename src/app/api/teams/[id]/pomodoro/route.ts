import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity";

async function requireMembership(teamId: string, userId: string) {
  return prisma.teamMember.findUnique({ where: { teamId_userId: { teamId, userId } } });
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const membership = await requireMembership(id, session.user.id);
  if (!membership) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const pomodoro = await prisma.pomodoroSession.findUnique({ where: { teamId: id } });
  return NextResponse.json({ pomodoro });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const membership = await requireMembership(id, session.user.id);
  if (!membership) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (membership.role !== "OWNER") {
    return NextResponse.json({ error: "Only the room's host can start a timer." }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const focusMinutes = Number.isInteger(body.focusMinutes) && body.focusMinutes > 0 && body.focusMinutes <= 180
    ? body.focusMinutes
    : 25;
  const breakMinutes = Number.isInteger(body.breakMinutes) && body.breakMinutes > 0 && body.breakMinutes <= 60
    ? body.breakMinutes
    : 5;
  const totalSessions = Number.isInteger(body.totalSessions) && body.totalSessions > 0 && body.totalSessions <= 20
    ? body.totalSessions
    : 4;

  const pomodoro = await prisma.pomodoroSession.upsert({
    where: { teamId: id },
    create: {
      teamId: id,
      startedById: session.user.id,
      focusMinutes,
      breakMinutes,
      totalSessions,
      currentPhase: "FOCUS",
      currentSessionNumber: 1,
      phaseStartedAt: new Date(),
      isRunning: true,
    },
    update: {
      startedById: session.user.id,
      focusMinutes,
      breakMinutes,
      totalSessions,
      currentPhase: "FOCUS",
      currentSessionNumber: 1,
      phaseStartedAt: new Date(),
      isRunning: true,
    },
  });

  await logActivity({
    teamId: id,
    actorId: session.user.id,
    action: "POMODORO_STARTED",
    metadata: { focusMinutes, breakMinutes, totalSessions },
  });

  return NextResponse.json({ pomodoro });
}

// Advance to the next phase once the client's local countdown reaches zero.
// The server re-derives elapsed time from phaseStartedAt rather than trusting
// the client, so a stray/duplicate call can't skip phases early.
export async function PATCH(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const membership = await requireMembership(id, session.user.id);
  if (!membership) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const pomodoro = await prisma.pomodoroSession.findUnique({ where: { teamId: id } });
  if (!pomodoro || !pomodoro.isRunning) {
    return NextResponse.json({ pomodoro });
  }

  const phaseDurationMs =
    (pomodoro.currentPhase === "FOCUS" ? pomodoro.focusMinutes : pomodoro.breakMinutes) * 60_000;
  const elapsedMs = Date.now() - pomodoro.phaseStartedAt.getTime();
  if (elapsedMs < phaseDurationMs) {
    return NextResponse.json({ pomodoro });
  }

  let nextPhase: "FOCUS" | "BREAK" = pomodoro.currentPhase === "FOCUS" ? "BREAK" : "FOCUS";
  let nextSessionNumber = pomodoro.currentSessionNumber;
  let stillRunning = true;

  if (pomodoro.currentPhase === "BREAK") {
    nextSessionNumber += 1;
    if (nextSessionNumber > pomodoro.totalSessions) {
      stillRunning = false;
      nextPhase = pomodoro.currentPhase; // freeze on the last completed phase
      nextSessionNumber = pomodoro.currentSessionNumber;
    }
  }

  const updated = await prisma.pomodoroSession.update({
    where: { teamId: id },
    data: {
      currentPhase: nextPhase,
      currentSessionNumber: nextSessionNumber,
      phaseStartedAt: new Date(),
      isRunning: stillRunning,
    },
  });

  return NextResponse.json({ pomodoro: updated });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const membership = await requireMembership(id, session.user.id);
  if (!membership) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (membership.role !== "OWNER") {
    return NextResponse.json({ error: "Only the room's host can stop the timer." }, { status: 403 });
  }

  await prisma.pomodoroSession.deleteMany({ where: { teamId: id } });
  return NextResponse.json({ ok: true });
}
