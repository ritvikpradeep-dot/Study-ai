// Shared between server and client code — no Node-only dependencies here,
// unlike pusher-server.ts (which pulls in the server "pusher" package and
// must never be imported from client components).
export function teamChannelName(teamId: string): string {
  return `private-team-${teamId}`;
}
