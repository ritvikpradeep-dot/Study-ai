"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Timer, Play, Square, ChevronDown, ChevronUp } from "lucide-react";

type PomodoroState = {
  focusMinutes: number;
  breakMinutes: number;
  currentPhase: "FOCUS" | "BREAK";
  currentSessionNumber: number;
  totalSessions: number;
  phaseStartedAt: string;
  isRunning: boolean;
} | null;

const POLL_INTERVAL_MS = 5000;

// A short two-tone beep via Web Audio — no audio asset needed, and it's
// muted/skipped automatically if the browser blocks autoplay before any
// user interaction.
function playTransitionBeep() {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 660;
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    osc.start();
    osc.stop(ctx.currentTime + 0.4);
  } catch {
    // Autoplay blocked or unsupported — silently skip, not worth surfacing.
  }
}

function formatTime(ms: number) {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function PomodoroTimer({ teamId, isHost }: { teamId: string; isHost: boolean }) {
  const [pomodoro, setPomodoro] = useState<PomodoroState>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [focusMinutes, setFocusMinutes] = useState(25);
  const [breakMinutes, setBreakMinutes] = useState(5);
  const [totalSessions, setTotalSessions] = useState(4);
  const [now, setNow] = useState(() => Date.now());
  const lastPhaseRef = useRef<string | null>(null);
  const advancingRef = useRef(false);

  const fetchState = useCallback(async () => {
    const res = await fetch(`/api/teams/${teamId}/pomodoro`);
    const data = await res.json().catch(() => ({}));
    if (data.pomodoro) {
      if (lastPhaseRef.current && lastPhaseRef.current !== data.pomodoro.currentPhase) {
        playTransitionBeep();
      }
      lastPhaseRef.current = data.pomodoro.currentPhase;
    }
    setPomodoro(data.pomodoro ?? null);
  }, [teamId]);

  useEffect(() => {
    fetchState();
    const interval = setInterval(fetchState, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchState]);

  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(tick);
  }, []);

  const phaseDurationMs = pomodoro
    ? (pomodoro.currentPhase === "FOCUS" ? pomodoro.focusMinutes : pomodoro.breakMinutes) * 60_000
    : 0;
  const elapsedMs = pomodoro ? now - new Date(pomodoro.phaseStartedAt).getTime() : 0;
  const remainingMs = phaseDurationMs - elapsedMs;

  useEffect(() => {
    if (!pomodoro || !pomodoro.isRunning || remainingMs > 0 || advancingRef.current) return;
    advancingRef.current = true;
    fetch(`/api/teams/${teamId}/pomodoro`, { method: "PATCH" })
      .then(() => fetchState())
      .finally(() => {
        advancingRef.current = false;
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remainingMs, pomodoro?.isRunning]);

  const start = async () => {
    const res = await fetch(`/api/teams/${teamId}/pomodoro`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ focusMinutes, breakMinutes, totalSessions }),
    });
    const data = await res.json().catch(() => ({}));
    if (data.pomodoro) {
      lastPhaseRef.current = data.pomodoro.currentPhase;
      setPomodoro(data.pomodoro);
    }
  };

  const stop = async () => {
    await fetch(`/api/teams/${teamId}/pomodoro`, { method: "DELETE" }).catch(() => {});
    lastPhaseRef.current = null;
    setPomodoro(null);
  };

  return (
    <div className="glass rounded-2xl p-4">
      <button
        onClick={() => setCollapsed((v) => !v)}
        className="flex w-full items-center justify-between text-left"
      >
        <span className="flex items-center gap-1.5 font-medium">
          <Timer size={16} className="text-accent" /> Timer
        </span>
        {collapsed ? <ChevronDown size={15} /> : <ChevronUp size={15} />}
      </button>

      {!collapsed && (
        <div className="mt-3">
          {pomodoro ? (
            <div className="flex flex-col items-center gap-2">
              <p className="text-xs uppercase tracking-wide opacity-60">
                {pomodoro.isRunning
                  ? pomodoro.currentPhase === "FOCUS"
                    ? "Focus"
                    : "Break"
                  : "Complete"}
              </p>
              <p className="text-3xl font-semibold tabular-nums">
                {pomodoro.isRunning ? formatTime(remainingMs) : "🎉"}
              </p>
              <p className="text-xs opacity-60">
                Session {pomodoro.currentSessionNumber} of {pomodoro.totalSessions}
              </p>
              {isHost && (
                <button
                  onClick={stop}
                  className="mt-1 flex items-center gap-1 rounded-lg px-2 py-1 text-xs opacity-70 transition hover:bg-black/5 hover:opacity-100 dark:hover:bg-white/10"
                >
                  <Square size={11} /> Stop
                </button>
              )}
            </div>
          ) : isHost ? (
            <div className="flex flex-col gap-2">
              <div className="grid grid-cols-3 gap-2 text-xs">
                <label className="flex flex-col gap-1">
                  Focus (min)
                  <input
                    type="number"
                    min={1}
                    max={180}
                    value={focusMinutes}
                    onChange={(e) => setFocusMinutes(Number(e.target.value) || 25)}
                    className="rounded-lg border border-black/10 bg-transparent px-2 py-1 dark:border-white/10"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  Break (min)
                  <input
                    type="number"
                    min={1}
                    max={60}
                    value={breakMinutes}
                    onChange={(e) => setBreakMinutes(Number(e.target.value) || 5)}
                    className="rounded-lg border border-black/10 bg-transparent px-2 py-1 dark:border-white/10"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  Sessions
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={totalSessions}
                    onChange={(e) => setTotalSessions(Number(e.target.value) || 4)}
                    className="rounded-lg border border-black/10 bg-transparent px-2 py-1 dark:border-white/10"
                  />
                </label>
              </div>
              <button
                onClick={start}
                className="flex items-center justify-center gap-1.5 rounded-xl bg-accent py-2 text-sm font-medium text-accent-foreground transition hover:opacity-90"
              >
                <Play size={13} /> Start Pomodoro
              </button>
            </div>
          ) : (
            <p className="text-center text-sm opacity-60">Waiting for the host to start a timer.</p>
          )}
        </div>
      )}
    </div>
  );
}
