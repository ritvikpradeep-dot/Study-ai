"use client";

import { FileText, Sparkles, CheckCircle2 } from "lucide-react";

export function HeroPreview() {
  return (
    <div className="glass animate-scale-in relative mx-auto w-full max-w-lg overflow-hidden rounded-2xl p-4 shadow-2xl">
      <div className="mb-3 flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
        <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
        <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
        <span className="ml-2 flex items-center gap-1.5 rounded-full bg-black/5 px-2.5 py-0.5 text-xs opacity-60 dark:bg-white/10">
          <FileText size={12} /> Cardiovascular-Health.pdf
        </span>
      </div>

      <div className="flex flex-col gap-2.5">
        <div className="ml-auto max-w-[75%] rounded-2xl rounded-br-sm bg-accent px-3.5 py-2 text-xs text-accent-foreground animate-fade-in">
          Summarize the key risk factors as bullet points
        </div>

        <div
          className="max-w-[85%] rounded-2xl rounded-bl-sm bg-black/5 px-3.5 py-2.5 text-xs opacity-90 dark:bg-white/10 animate-fade-in"
          style={{ animationDelay: "250ms" }}
        >
          <div className="mb-1.5 flex items-center gap-1 font-medium text-accent">
            <Sparkles size={12} /> StudyAI
          </div>
          <ul className="ml-3.5 list-disc space-y-1 opacity-80">
            <li>High-sodium diet &amp; sedentary lifestyle</li>
            <li>Chronic stress and poor sleep</li>
            <li>Family history &amp; genetics</li>
          </ul>
        </div>

        <div
          className="glass flex items-center justify-between rounded-xl px-3.5 py-2.5 text-xs animate-fade-in"
          style={{ animationDelay: "500ms" }}
        >
          <span className="flex items-center gap-1.5 font-medium">
            <CheckCircle2 size={13} className="text-emerald-500" /> Quiz generated — 10 questions
          </span>
          <span className="opacity-50">8/10 correct</span>
        </div>
      </div>
    </div>
  );
}
