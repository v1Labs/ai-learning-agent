"use client";

import { useEffect } from "react";
import type { PublicCard } from "@/lib/types";
import { DiscoveryCard } from "./DiscoveryCard";

/** Shown on level-up (with a celebration header) or when opening a collected card. */
export function LevelUpModal({ card, level, onClose }: { card: PublicCard; level: number | null; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-md animate-[pop_300ms_ease-out]" onClick={(e) => e.stopPropagation()}>
        {level !== null && (
          <div className="mb-4 text-center text-white">
            <div className="text-sm font-medium uppercase tracking-widest text-amber-300">Level up!</div>
            <div className="text-3xl font-bold">You reached Level {level}</div>
            <div className="mt-1 text-sm text-white/80">You earned a discovery card</div>
          </div>
        )}
        <DiscoveryCard card={card} />
        <button
          onClick={onClose}
          className="mt-4 w-full rounded-xl bg-white px-4 py-3 font-medium text-zinc-900 hover:bg-zinc-100"
        >
          {level !== null ? "Keep going →" : "Close"}
        </button>
      </div>
    </div>
  );
}
