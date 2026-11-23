"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PublicCard } from "@/lib/types";
import { CardBack, CardFront } from "./DiscoveryCard";

export const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Level-up mode (ADR 0014): backdrop fades in, headline pops, the card slides
 * up face-down, flips once its content is ready, and on close flies into its
 * tray slot. View mode (clicking a collected card) just shows the front.
 */
export function CardModal({
  card,
  total,
  levelUp,
  onClose,
}: {
  card: PublicCard;
  total: number;
  /** The level just reached, or null when viewing a collected card. */
  levelUp: number | null;
  onClose: () => void;
}) {
  const reduce = prefersReducedMotion();
  const animate = levelUp !== null && !reduce;
  const overlayRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const [showCard, setShowCard] = useState(!animate);
  // The card stays face-down for a beat before flipping, so the flip reads as a reveal.
  const [settled, setSettled] = useState(!animate);
  const [closing, setClosing] = useState(false);
  const flipped = settled && card.state === "revealed";

  useEffect(() => {
    if (!animate) return;
    const t1 = setTimeout(() => setShowCard(true), 450);
    const t2 = setTimeout(() => setSettled(true), 1250);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [animate]);

  const close = useCallback(async () => {
    if (closing) return;
    setClosing(true);
    const slot = document.querySelector<HTMLElement>(`[data-card-slot="${card.id}"]`);
    const el = cardRef.current;
    if (animate && slot && el) {
      // Fly the card into its tray slot (FLIP-style: measure, then animate the transform).
      const from = el.getBoundingClientRect();
      const to = slot.getBoundingClientRect();
      const dx = to.left + to.width / 2 - (from.left + from.width / 2);
      const dy = to.top + to.height / 2 - (from.top + from.height / 2);
      const scale = Math.max(to.width / from.width, 0.05);
      const easing = "cubic-bezier(0.5, 0, 0.2, 1)";
      await Promise.all([
        el.animate([{ transform: "none" }, { transform: `translate(${dx}px, ${dy}px) scale(${scale})`, opacity: 0.6 }], {
          duration: 550,
          easing,
          fill: "forwards",
        }).finished,
        overlayRef.current?.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 550, easing, fill: "forwards" }).finished,
      ]);
    }
    onClose();
  }, [animate, card.id, closing, onClose]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Discovery card">
      <div
        ref={overlayRef}
        className="absolute inset-0 animate-[fade-in_250ms_ease-out] bg-zinc-950/60 backdrop-blur-sm"
        onClick={close}
      />
      <div className="relative w-full max-w-sm">
        {levelUp !== null && (
          <div className={`mb-5 text-center text-white ${closing ? "opacity-0 transition-opacity duration-300" : ""}`}>
            <div className="animate-[pop_400ms_ease-out] text-sm font-semibold uppercase tracking-[0.25em] text-amber-300">
              Level up!
            </div>
            <div className="animate-[pop_500ms_ease-out] text-3xl font-bold">You reached Level {levelUp}</div>
            <div className="mt-1 animate-[fade-in_600ms_ease-out] text-sm text-white/80">
              {card.state === "revealed" || !settled ? "You earned a discovery card" : "Your card is on its way…"}
            </div>
          </div>
        )}

        <div ref={cardRef} className={`flip-scene ${showCard ? "animate-[card-enter_500ms_cubic-bezier(0.2,0.8,0.2,1)]" : "invisible"}`}>
          {levelUp === null && card.state === "revealed" ? (
            <CardFront card={card} total={total} />
          ) : (
            <div className={`flip-card ${flipped ? "is-flipped" : ""}`}>
              <div className="flip-face" aria-hidden={flipped}>
                <CardBack level={card.level} kind={card.kind} researching={settled && card.state !== "revealed"} />
              </div>
              <div className="flip-face flip-face-front" aria-hidden={!flipped}>
                {card.state === "revealed" && <CardFront card={card} total={total} />}
              </div>
            </div>
          )}
        </div>

        <button
          onClick={close}
          className={`mt-5 w-full rounded-xl bg-white px-4 py-3 font-medium text-zinc-900 shadow-lg transition-opacity duration-300 hover:bg-zinc-100 ${
            settled && !closing ? "opacity-100" : "pointer-events-none opacity-0"
          }`}
        >
          {levelUp !== null ? (flipped ? "Add to collection & keep going →" : "Keep going, it'll land in your collection →") : "Close"}
        </button>
      </div>
    </div>
  );
}
