import { GiveMark } from "@/components/GiveMark";

/**
 * "Microsoft Give · Step Challenge" lockup — a small Microsoft wordmark
 * above a colorful "GIVE" wordmark (each letter in one of the four brand
 * colors) plus a "Step Challenge" subtitle. Echoes the Microsoft Give
 * program's visual identity without reproducing its logo. `size="lg"` is
 * used for the hero on the landing page; the default (small) size is used
 * in the sticky header nav.
 */
export function GiveLogo({
  className = "",
  size = "sm",
}: {
  className?: string;
  size?: "sm" | "lg";
}) {
  const isLg = size === "lg";
  return (
    <span className={`flex items-center ${isLg ? "gap-3.5" : "gap-2.5"} ${className}`}>
      <GiveMark className={isLg ? "w-11 h-11" : "w-7 h-7"} />
      <span className="leading-tight">
        <span
          className={`block font-medium tracking-wide text-gray-400 uppercase ${
            isLg ? "text-xs" : "text-[10px]"
          }`}
        >
          Microsoft
        </span>
        <span className={`flex items-baseline ${isLg ? "gap-2.5" : "gap-1.5"}`}>
          <span className={`font-extrabold tracking-tight ${isLg ? "text-3xl" : "text-lg"}`}>
            <span className="text-msred">G</span>
            <span className="text-msyellow">I</span>
            <span className="text-msgreen">V</span>
            <span className="text-msblue">E</span>
          </span>
          <span className={`font-semibold text-gray-700 ${isLg ? "text-lg" : "text-sm"}`}>
            Step Challenge
          </span>
        </span>
      </span>
    </span>
  );
}
