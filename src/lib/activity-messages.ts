// Shared between the activity API route (server) and the feed component
// (client) — no server-only imports, so it's safe in both.
import type { ActivityAction } from "@prisma/client";

type Meta = Record<string, unknown> | null | undefined;

function targetName(metadata: Meta): string {
  const name = metadata && typeof metadata === "object" ? (metadata as Record<string, unknown>).targetName : undefined;
  return typeof name === "string" ? name : "a member";
}

// Singular, specific phrasing for one entry.
export function describeActivity(action: ActivityAction, actorName: string, metadata: Meta): string {
  const meta = (metadata as Record<string, unknown>) ?? {};
  switch (action) {
    case "DOCUMENT_UPLOADED":
      return `${actorName} uploaded ${typeof meta.title === "string" ? `"${meta.title}"` : "a document"}`;
    case "NOTE_ADDED":
      return `${actorName} added a note`;
    case "HIGHLIGHT_ADDED":
      return `${actorName} added a highlight${typeof meta.page === "number" ? ` on page ${meta.page}` : ""}`;
    case "DRAWING_ADDED":
      return `${actorName} drew on page ${typeof meta.page === "number" ? meta.page : "?"}`;
    case "STICKY_NOTE_ADDED":
      return `${actorName} placed a sticky note`;
    case "MEMBER_JOINED":
      return `${actorName} joined the room`;
    case "MEMBER_LEFT":
      return `${actorName} left the room`;
    case "MEMBER_KICKED":
      return `${actorName} removed ${targetName(metadata)} from the room`;
    case "EDIT_ACCESS_GRANTED":
      return `${actorName} granted ${targetName(metadata)} edit access`;
    case "EDIT_ACCESS_REVOKED":
      return `${actorName} revoked ${targetName(metadata)}'s edit access`;
    case "POMODORO_STARTED":
      return `${actorName} started a Pomodoro session`;
    case "POMODORO_STOPPED":
      return `${actorName} stopped the Pomodoro timer`;
    case "ROOM_CLOSED":
      return `${actorName} closed the room`;
    case "INVITE_CODE_REGENERATED":
      return `${actorName} generated a new invite code`;
    default:
      return `${actorName} did something`;
  }
}

// Actions worth collapsing when the same actor does several in a row
// ("Maya added 4 highlights" instead of 4 separate lines) — only the
// content-annotation actions, never membership/permission/room events,
// which should always stay individually visible.
const GROUPABLE: Partial<Record<ActivityAction, string>> = {
  HIGHLIGHT_ADDED: "highlight",
  NOTE_ADDED: "note",
  DRAWING_ADDED: "stroke",
  STICKY_NOTE_ADDED: "sticky note",
};

export function isGroupable(action: ActivityAction): boolean {
  return action in GROUPABLE;
}

export function describeGroup(action: ActivityAction, actorName: string, count: number): string {
  const noun = GROUPABLE[action] ?? "item";
  return `${actorName} added ${count} ${noun}${count === 1 ? "" : "s"}`;
}
