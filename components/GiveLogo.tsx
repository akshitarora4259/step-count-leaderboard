import { GiveMark } from "@/components/GiveMark";

/**
 * "Microsoft Give · Step Challenge" lockup used in the header — a small
 * Microsoft wordmark above a colorful "GIVE" wordmark (each letter in one
 * of the four brand colors) plus a "Step Challenge" subtitle. Echoes the
 * Microsoft Give program's visual identity without reproducing its logo.
 */
export function GiveLogo({ className = "" }: { className?: string }) {
  return (
    <span className={`flex items-center gap-2.5 ${className}`}>
      <GiveMark className="w-7 h-7" />
      <span className="leading-tight">
        <span className="block text-[10px] font-medium tracking-wide text-gray-400 uppercase">
          Microsoft
        </span>
        <span className="flex items-baseline gap-1.5">
          <span className="font-extrabold tracking-tight text-lg">
            <span className="text-msred">G</span>
            <span className="text-msyellow">I</span>
            <span className="text-msgreen">V</span>
            <span className="text-msblue">E</span>
          </span>
          <span className="text-sm font-semibold text-gray-700">Step Challenge</span>
        </span>
      </span>
    </span>
  );
}
