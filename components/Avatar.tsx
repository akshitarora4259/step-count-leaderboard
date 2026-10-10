const PALETTE = [
  { bg: "bg-msred/15", text: "text-msred" },
  { bg: "bg-msgreen/15", text: "text-msgreen" },
  { bg: "bg-msblue/15", text: "text-msblue" },
  { bg: "bg-msyellow/20", text: "text-[#8a6500]" },
];

function hashName(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash << 5) - hash + name.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** A deterministic, color-coded initials circle — no external avatar images needed. */
export function Avatar({
  name,
  size = "md",
}: {
  name: string;
  size?: "sm" | "md" | "lg";
}) {
  const { bg, text } = PALETTE[hashName(name) % PALETTE.length];
  const sizeClass =
    size === "lg" ? "w-14 h-14 text-lg" : size === "sm" ? "w-8 h-8 text-xs" : "w-10 h-10 text-sm";

  return (
    <span
      className={`inline-flex items-center justify-center rounded-full font-semibold shrink-0 ${bg} ${text} ${sizeClass}`}
      aria-hidden="true"
    >
      {initialsFor(name)}
    </span>
  );
}
