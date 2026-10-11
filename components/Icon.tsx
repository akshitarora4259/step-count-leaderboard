type IconName =
  | "fitbit"
  | "sync"
  | "crown"
  | "calendar"
  | "lock"
  | "check"
  | "heart"
  | "footsteps"
  | "chart"
  | "rank"
  | "users"
  | "gift"
  | "bag"
  | "sparkles"
  | "camera";

/**
 * Renders one of the monochrome SVG icons from the "polished" design pack
 * (public/images/give/icons/). Icons use `stroke/fill: currentColor`, so an
 * <img> can't inherit page text color — instead we recolor via a CSS
 * `filter` utility class (see the `*-filter` classes in globals.css), the
 * same technique the reference stylesheet uses.
 */
export function Icon({
  name,
  className = "",
  alt = "",
}: {
  name: IconName;
  className?: string;
  alt?: string;
}) {
  return (
    <img
      src={`/images/give/icons/${name}.svg`}
      alt={alt}
      aria-hidden={alt === "" ? true : undefined}
      className={`icon ${className}`.trim()}
    />
  );
}
