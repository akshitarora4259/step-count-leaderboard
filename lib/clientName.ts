/**
 * Tiny client-side helper for remembering which participant "this browser"
 * last connected as. There's no login system in this app (by design — see
 * requirement #6, no auth), so this is just a convenience so the nav's "Me"
 * link and avatar can find the right profile without the user retyping
 * their name every visit. Never used for anything security-sensitive.
 */
const STORAGE_KEY = "stepchallenge.name";

export function getStoredName(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setStoredName(name: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, name);
  } catch {
    // Ignore (e.g. private browsing storage restrictions).
  }
}

export function clearStoredName(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore.
  }
}
