import type { CardKind, PublicCard } from "@/lib/types";

export const KIND_LABEL: Record<CardKind, string> = {
  origin: "Origin story",
  real_world: "In the real world",
  big_picture: "Big picture",
};

/** Face of a discovery card. Content is rendered as plain text; only the source is a link. */
export function DiscoveryCard({ card }: { card: PublicCard }) {
  return (
    <div className="overflow-hidden rounded-2xl bg-gradient-to-br from-amber-300 via-orange-400 to-rose-500 p-[3px] shadow-xl">
      <div className="rounded-[13px] bg-white p-5 dark:bg-zinc-950">
        <div className="text-xs font-semibold uppercase tracking-wider text-orange-600 dark:text-orange-400">
          {KIND_LABEL[card.kind]} · Level {card.level}
        </div>
        {card.state === "revealed" ? (
          <>
            <h3 className="mt-2 text-xl font-semibold leading-snug">{card.title}</h3>
            <p className="mt-3 text-zinc-700 dark:text-zinc-300">{card.fact}</p>
            <p className="mt-3 text-sm text-zinc-500">{card.connection}</p>
            <div className="mt-4 border-t border-zinc-200 pt-3 text-xs text-zinc-500 dark:border-zinc-800">
              {card.source ? (
                <a href={card.source.url} target="_blank" rel="noopener noreferrer nofollow" className="hover:underline">
                  Source: {card.source.domain} ↗
                </a>
              ) : (
                <span>From your document</span>
              )}
            </div>
          </>
        ) : (
          <div className="flex items-center gap-3 py-8 text-zinc-500">
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-zinc-300 border-t-orange-500" />
            Researching your card…
          </div>
        )}
      </div>
    </div>
  );
}
