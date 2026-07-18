"use client";

const EMOJI = ["👍", "💡", "❓", "✅"];

export type ReactionItem = {
  targetType: "NOTE" | "HIGHLIGHT";
  targetId: string;
  emoji: string;
  authorId: string;
  authorName: string;
  isMine: boolean;
};

export function ReactionBar({
  reactions,
  onToggle,
}: {
  reactions: ReactionItem[];
  onToggle: (emoji: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1">
      {EMOJI.map((emoji) => {
        const forEmoji = reactions.filter((r) => r.emoji === emoji);
        if (forEmoji.length === 0) {
          return (
            <button
              key={emoji}
              onClick={() => onToggle(emoji)}
              className="rounded-full px-1.5 py-0.5 text-xs opacity-40 transition hover:bg-black/5 hover:opacity-100 dark:hover:bg-white/10"
              title="React"
            >
              {emoji}
            </button>
          );
        }
        const mine = forEmoji.some((r) => r.isMine);
        return (
          <button
            key={emoji}
            onClick={() => onToggle(emoji)}
            title={forEmoji.map((r) => r.authorName).join(", ")}
            className={`flex items-center gap-1 rounded-full px-1.5 py-0.5 text-xs transition ${
              mine ? "bg-accent/20 ring-1 ring-accent" : "bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/20"
            }`}
          >
            {emoji} <span className="tabular-nums opacity-70">{forEmoji.length}</span>
          </button>
        );
      })}
    </div>
  );
}
