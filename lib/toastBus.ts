/**
 * Tiny pub/sub so any component (connect button on `/`, disconnect button on
 * `/me`, etc.) can trigger the single shared `#toast` notification rendered
 * once in the root layout, without prop-drilling or a full context provider.
 * Mirrors the reference prototype's `notify(message)` helper, but driven by
 * real action outcomes instead of canned strings.
 */
type Listener = (message: string) => void;

const listeners = new Set<Listener>();

export function notify(message: string): void {
  for (const listener of listeners) listener(message);
}

export function subscribeToast(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
