"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

export function Accordion({ items }: { items: { question: string; answer: string }[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <div className="flex flex-col gap-2">
      {items.map((item, i) => {
        const isOpen = openIndex === i;
        return (
          <div key={item.question} className="glass overflow-hidden rounded-2xl">
            <button
              onClick={() => setOpenIndex(isOpen ? null : i)}
              className="flex w-full items-center justify-between px-5 py-4 text-left font-medium"
              aria-expanded={isOpen}
            >
              {item.question}
              <ChevronDown
                size={18}
                className={`shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`}
              />
            </button>
            {isOpen && (
              <div className="animate-slide-up px-5 pb-4 text-sm opacity-70">{item.answer}</div>
            )}
          </div>
        );
      })}
    </div>
  );
}
