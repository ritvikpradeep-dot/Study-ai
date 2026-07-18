"use client";

import PusherClient from "pusher-js";
import { teamChannelName } from "@/lib/pusher-channels";

let client: PusherClient | null = null;

export function isPusherClientConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_PUSHER_KEY && process.env.NEXT_PUBLIC_PUSHER_CLUSTER);
}

function getPusherClient(): PusherClient | null {
  if (!isPusherClientConfigured()) return null;
  if (client) return client;
  client = new PusherClient(process.env.NEXT_PUBLIC_PUSHER_KEY!, {
    cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
    authEndpoint: "/api/pusher/auth",
  });
  return client;
}

// Multiple components on the same page (e.g. TeamWorkspace and its child
// ActivityFeed) each subscribe to the same team channel independently.
// pusher-js's own subscribe() returns the same Channel object for repeat
// calls, but unsubscribe() tears the whole thing down regardless of other
// callers — so we ref-count here to make sure the channel only actually
// closes once every subscriber has unmounted.
const refCounts = new Map<string, number>();

// Subscribes to a room's private channel and returns an unsubscribe
// function. No-ops (returns a no-op cleanup) if Pusher isn't configured, so
// callers don't need to branch on availability.
export function subscribeToTeam(teamId: string): {
  channel: ReturnType<PusherClient["subscribe"]> | null;
  unsubscribe: () => void;
} {
  const pusher = getPusherClient();
  if (!pusher) return { channel: null, unsubscribe: () => {} };
  const channelName = teamChannelName(teamId);
  const channel = pusher.subscribe(channelName);
  refCounts.set(channelName, (refCounts.get(channelName) ?? 0) + 1);

  let released = false;
  return {
    channel,
    unsubscribe: () => {
      if (released) return; // guard against double-invocation (e.g. React strict mode)
      released = true;
      const remaining = (refCounts.get(channelName) ?? 1) - 1;
      if (remaining <= 0) {
        refCounts.delete(channelName);
        pusher.unsubscribe(channelName);
      } else {
        refCounts.set(channelName, remaining);
      }
    },
  };
}
