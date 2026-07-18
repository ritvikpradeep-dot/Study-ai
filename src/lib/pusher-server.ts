import Pusher from "pusher";
import { teamChannelName } from "@/lib/pusher-channels";

export { teamChannelName };

let client: Pusher | null = null;

export function isPusherConfigured(): boolean {
  return Boolean(
    process.env.PUSHER_APP_ID &&
      process.env.NEXT_PUBLIC_PUSHER_KEY &&
      process.env.PUSHER_SECRET &&
      process.env.NEXT_PUBLIC_PUSHER_CLUSTER
  );
}

function getPusherClient(): Pusher {
  if (client) return client;
  if (!isPusherConfigured()) {
    throw new Error("Pusher is not configured. Set PUSHER_APP_ID/NEXT_PUBLIC_PUSHER_KEY/PUSHER_SECRET/NEXT_PUBLIC_PUSHER_CLUSTER.");
  }
  client = new Pusher({
    appId: process.env.PUSHER_APP_ID!,
    key: process.env.NEXT_PUBLIC_PUSHER_KEY!,
    secret: process.env.PUSHER_SECRET!,
    cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
    useTLS: true,
  });
  return client;
}

// Best-effort broadcast to every client subscribed to a room's channel —
// never throws, since a realtime notification failing shouldn't break the
// underlying action (upload, edit, etc.) that triggered it.
export async function notifyTeam(teamId: string, event: string, payload: unknown) {
  if (!isPusherConfigured()) return;
  try {
    await getPusherClient().trigger(teamChannelName(teamId), event, payload);
  } catch {
    // Swallow — see comment above.
  }
}

// Signs a private-channel subscription request. Caller is responsible for
// verifying the requesting user actually belongs to the room before calling
// this — it only produces the signature, it doesn't check membership itself.
export function authorizeTeamChannel(socketId: string, channelName: string) {
  return getPusherClient().authorizeChannel(socketId, channelName);
}
