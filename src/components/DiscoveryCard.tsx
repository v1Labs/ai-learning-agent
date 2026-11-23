import type { CardKind, PublicCard } from "@/lib/types";

export const KIND_LABEL: Record<CardKind, string> = {
  origin: "Origin story",
  real_world: "In the real world",
  big_picture: "Big picture",
};

type RevealedCard = Extract<PublicCard, { state: "revealed" }>;

/** Front of a discovery card. Content is rendered as plain text; only the source is a link. */
export function CardFront({ card, total }: { card: RevealedCard; total: number }) {
  return (
    <article className="flex h-full flex-col overflow-hidden rounded-2xl border-2 border-orange-500 bg-white shadow-xl dark:bg-zinc-950">
      <header className="flex items-start gap-3 bg-orange-500 px-4 py-3 text-white">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-sm font-bold text-orange-600">
          {card.level}
        </span>
        <div className="min-w-0">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-orange-100">
            {KIND_LABEL[card.kind]} · {card.level} of {total}
          </div>
          <h3 className="text-lg font-bold leading-snug">{card.title}</h3>
        </div>
      </header>
      <div className="flex flex-1 flex-col px-4 py-4">
        <p className="text-[15px] leading-relaxed text-zinc-800 dark:text-zinc-200">{card.fact}</p>
        <p className="mt-3 flex gap-2 text-sm text-zinc-500">
          <span aria-hidden className="text-orange-500">
            ↳
          </span>
          {card.connection}
        </p>
        <footer className="mt-auto flex items-center justify-between gap-2 border-t border-zinc-200 pt-3 text-xs text-zinc-500 dark:border-zinc-800">
          {card.source ? (
            <a
              href={card.source.url}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="truncate hover:text-orange-600 hover:underline"
            >
              Source: {card.source.domain} ↗
            </a>
          ) : (
            <span>From your document</span>
          )}
          <span className="shrink-0 rounded-full bg-orange-100 px-2 py-0.5 font-medium text-orange-700 dark:bg-orange-950 dark:text-orange-300">
            Level {card.level}
          </span>
        </footer>
      </div>
    </article>
  );
}

/** Back of a card: shown before the flip, and while the card is still being researched. */
export function CardBack({ level, kind, researching }: { level: number; kind: CardKind; researching: boolean }) {
  return (
    <div className="relative flex h-full min-h-72 flex-col items-center justify-center overflow-hidden rounded-2xl border-2 border-orange-600 bg-orange-500 text-white shadow-xl">
      <div
        aria-hidden
        className="absolute inset-0 opacity-20"
        style={{ backgroundImage: "radial-gradient(circle at 1px 1px, white 1.5px, transparent 0)", backgroundSize: "18px 18px" }}
      />
      {researching && <div aria-hidden className="shimmer absolute inset-0" />}
      <span className="relative flex h-16 w-16 items-center justify-center rounded-full bg-white text-3xl font-bold text-orange-600 shadow-lg">
        {level}
      </span>
      <div className="relative mt-4 text-xs font-semibold uppercase tracking-widest text-orange-100">Discovery card</div>
      <div className="relative mt-1 text-lg font-bold">{KIND_LABEL[kind]}</div>
      {researching && <div className="relative mt-3 text-sm text-orange-100">Researching your card…</div>}
    </div>
  );
}

/** Static card for lists (e.g. the progress report). */
export function DiscoveryCard({ card, total }: { card: PublicCard; total: number }) {
  return card.state === "revealed" ? (
    <CardFront card={card} total={total} />
  ) : (
    <CardBack level={card.level} kind={card.kind} researching={card.state === "researching"} />
  );
}
