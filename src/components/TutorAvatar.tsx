import { TUTOR } from "@/lib/persona";

/** Sage's avatar: a friendly owl, drawn inline so there are no image assets to load. */
export function TutorAvatar({ size = 36, thinking = false }: { size?: number; thinking?: boolean }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      role="img"
      aria-label={`${TUTOR.name}, your tutor`}
      className="shrink-0"
    >
      <circle cx="24" cy="24" r="24" className="fill-indigo-600" />
      {/* ear tufts */}
      <path d="M11 13 L15 20 L19 15 Z M37 13 L33 20 L29 15 Z" className="fill-indigo-300" />
      {/* face */}
      <ellipse cx="24" cy="27" rx="14" ry="13" className="fill-indigo-100" />
      {/* eyes */}
      <circle cx="18" cy="25" r="5.5" className="fill-white stroke-indigo-300" strokeWidth="1" />
      <circle cx="30" cy="25" r="5.5" className="fill-white stroke-indigo-300" strokeWidth="1" />
      <g className={thinking ? "animate-pulse" : undefined}>
        <circle cx={thinking ? 19.5 : 18.5} cy={thinking ? 23.5 : 25.5} r="2.6" className="fill-zinc-900" />
        <circle cx={thinking ? 31.5 : 30.5} cy={thinking ? 23.5 : 25.5} r="2.6" className="fill-zinc-900" />
      </g>
      {/* beak */}
      <path d="M22 30 L26 30 L24 34 Z" className="fill-amber-400" />
    </svg>
  );
}
