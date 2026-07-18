"use client";

import { useEffect, useRef } from "react";
import type { Channel } from "pusher-js";
import { subscribeToTeam } from "@/lib/pusher-client";

// Subscribes to a room's realtime channel for the component's lifetime and
// hands back the raw channel so callers can `.bind(event, handler)` for
// whatever events they care about. No-ops safely if Pusher isn't configured
// (channel stays null) — callers should already have a polling fallback for
// that case, this is a purely additive enhancement. onChannel is only
// called once a real (non-null) channel exists.
export function useTeamChannel(teamId: string | null, onChannel: (channel: Channel) => void) {
  const onChannelRef = useRef(onChannel);
  useEffect(() => {
    onChannelRef.current = onChannel;
  });

  useEffect(() => {
    if (!teamId) return;
    const { channel, unsubscribe } = subscribeToTeam(teamId);
    if (channel) onChannelRef.current(channel);
    return unsubscribe;
  }, [teamId]);
}
