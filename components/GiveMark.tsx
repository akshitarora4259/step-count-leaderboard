/**
 * Small 2x2 colored-square "Give" brand mark, used in the header/footer.
 * Echoes Microsoft's four-color tile logo as a nod to the "Microsoft Give"
 * theme without reproducing the logo itself.
 */
export function GiveMark({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <span className={`grid grid-cols-2 grid-rows-2 gap-[2px] shrink-0 ${className}`} aria-hidden="true">
      <span className="bg-msred rounded-[1px]" />
      <span className="bg-msgreen rounded-[1px]" />
      <span className="bg-msblue rounded-[1px]" />
      <span className="bg-msyellow rounded-[1px]" />
    </span>
  );
}
