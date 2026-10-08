/**
 * Heuristic for extracting a step count from raw OCR text of a phone's
 * step-count screen. Picks the largest plausible integer found in the text,
 * since the step count is typically the largest/most prominent number
 * shown (other digits on screen, like dates or times, tend to be smaller).
 */
export function extractStepCount(ocrText: string): number | null {
  const matches = ocrText.match(/\d[\d,]*/g) ?? [];
  const numbers = matches
    .map((m) => parseInt(m.replace(/,/g, ""), 10))
    .filter((n) => Number.isFinite(n) && n >= 0 && n <= 999_999);

  if (numbers.length === 0) return null;
  return Math.max(...numbers);
}
