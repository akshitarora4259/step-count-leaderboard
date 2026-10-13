import path from "path";
import sharp from "sharp";

/**
 * EXPERIMENTAL, best-effort last resort.
 *
 * This template was cropped from a single blurry camera photo of a
 * smartwatch face (not a clean app screenshot). Because the source is
 * heavily blurred (macro shot through curved watch glass, motion/focus
 * blur, glare), it lacks the crisp edges normalized cross-correlation
 * template matching relies on. In practice this means:
 *   - It's only ever consulted when OCR found no "Steps" label AND no
 *     usable fallback number at all (see `parseStepCount` in ocr.ts) — a
 *     last resort, never overriding a more reliable signal.
 *   - The match-score threshold is intentionally strict, and a match is
 *     only useful if it lands near an OCR'd number token.
 *   - It is expected to misfire or fail to fire on most screenshots that
 *     don't closely resemble this source photo's icon style/blur profile.
 * Replace/add templates in `ocrTemplates/` (and extend `TEMPLATES` below)
 * with clean, in-focus samples if/when they become available — that would
 * meaningfully improve reliability over this starting point.
 */
const TEMPLATES = [
  {
    file: "footprint-icon-01.png",
    /** Width (px) of the photo this template was cropped from — used to
     * scale the template relative to the search image's width, since the
     * icon's size in a screenshot is roughly proportional to the overall
     * image size, not a fixed pixel count. */
    sourceImageWidth: 1593,
  },
];

const TEMPLATE_DIR = path.join(process.cwd(), "ocrTemplates");

/** Relative scales tried around each template's proportional size, to
 * tolerate screenshots where the icon renders larger/smaller than this
 * ratio would predict. */
const SCALE_FACTORS = [0.6, 0.8, 1.0, 1.3, 1.6];

/** Width the search image is downsampled to before matching — keeps the
 * brute-force scan fast while still preserving enough detail to correlate
 * against a small icon template. */
const SEARCH_WIDTH = 260;

/** Minimum normalized cross-correlation score to accept a candidate match.
 * Deliberately strict given the template's poor (blurry) quality — see the
 * module-level caveat above. */
const MATCH_THRESHOLD = 0.75;

/** Skip pixels while scanning, trading a little positional precision for a
 * large speedup — fine here since we only need a rough anchor point to find
 * the nearest OCR'd number, not a pixel-perfect box. */
const SCAN_STRIDE = 2;

type GrayImage = { data: Float64Array; width: number; height: number };

async function toGrayImage(buffer: Buffer, width?: number): Promise<GrayImage> {
  let pipeline = sharp(buffer).grayscale();
  if (width) pipeline = pipeline.resize({ width });
  const { data, info } = await pipeline.raw().toBuffer({ resolveWithObject: true });
  const floatData = new Float64Array(info.width * info.height);
  for (let i = 0; i < floatData.length; i++) floatData[i] = data[i];
  return { data: floatData, width: info.width, height: info.height };
}

type LoadedTemplate = GrayImage & { sourceImageWidth: number };

let templatesPromise: Promise<LoadedTemplate[]> | null = null;

function loadTemplates(): Promise<LoadedTemplate[]> {
  templatesPromise ??= Promise.all(
    TEMPLATES.map(async ({ file, sourceImageWidth }) => {
      const buffer = await sharp(path.join(TEMPLATE_DIR, file)).toBuffer();
      const gray = await toGrayImage(buffer);
      return { ...gray, sourceImageWidth };
    })
  );
  return templatesPromise;
}

/** Nearest-neighbor resampling — adequate for a small, already-blurry
 * template where sub-pixel precision wouldn't add real information. */
function resizeGrayImage(image: GrayImage, width: number, height: number): GrayImage {
  const resized = new Float64Array(width * height);
  const xRatio = image.width / width;
  const yRatio = image.height / height;
  for (let y = 0; y < height; y++) {
    const srcY = Math.min(image.height - 1, Math.floor(y * yRatio));
    for (let x = 0; x < width; x++) {
      const srcX = Math.min(image.width - 1, Math.floor(x * xRatio));
      resized[y * width + x] = image.data[srcY * image.width + srcX];
    }
  }
  return { data: resized, width, height };
}

/**
 * Normalized cross-correlation between `tmpl` and the equally-sized window
 * of `image` starting at (offsetX, offsetY). Returns a value in [-1, 1]
 * (ignoring float error); 1 means a perfect linear match.
 */
function ncc(image: GrayImage, tmpl: GrayImage, offsetX: number, offsetY: number): number {
  const n = tmpl.width * tmpl.height;
  let sumImg = 0;
  let sumTmpl = 0;
  for (let y = 0; y < tmpl.height; y++) {
    const row = (offsetY + y) * image.width + offsetX;
    for (let x = 0; x < tmpl.width; x++) {
      sumImg += image.data[row + x];
      sumTmpl += tmpl.data[y * tmpl.width + x];
    }
  }
  const meanImg = sumImg / n;
  const meanTmpl = sumTmpl / n;

  let numerator = 0;
  let denomImg = 0;
  let denomTmpl = 0;
  for (let y = 0; y < tmpl.height; y++) {
    const row = (offsetY + y) * image.width + offsetX;
    for (let x = 0; x < tmpl.width; x++) {
      const imgVal = image.data[row + x] - meanImg;
      const tmplVal = tmpl.data[y * tmpl.width + x] - meanTmpl;
      numerator += imgVal * tmplVal;
      denomImg += imgVal * imgVal;
      denomTmpl += tmplVal * tmplVal;
    }
  }
  const denom = Math.sqrt(denomImg * denomTmpl);
  return denom === 0 ? 0 : numerator / denom;
}

export type IconMatch = {
  /** Match center, in the coordinate space of the original `buffer` passed
   * to `matchFootprintIcon` (already converted back from the internal
   * downsampled search resolution). */
  x: number;
  y: number;
  score: number;
};

/**
 * Searches `buffer` (any image, original resolution) for the best match
 * against the bundled icon template(s), trying a handful of scales to
 * tolerate different screenshot sizes. Returns null if no candidate clears
 * `MATCH_THRESHOLD`. See the module-level caveat: this is a best-effort,
 * intentionally last-resort signal, not a primary detection strategy.
 */
export async function matchFootprintIcon(buffer: Buffer): Promise<IconMatch | null> {
  const [templates, search, originalMeta] = await Promise.all([
    loadTemplates(),
    toGrayImage(buffer, SEARCH_WIDTH),
    sharp(buffer).metadata(),
  ]);

  let best: IconMatch | null = null;

  for (const template of templates) {
    const nativeFraction = template.width / template.sourceImageWidth;
    for (const factor of SCALE_FACTORS) {
      const targetWidth = Math.max(6, Math.round(nativeFraction * SEARCH_WIDTH * factor));
      const targetHeight = Math.max(6, Math.round(targetWidth * (template.height / template.width)));
      if (targetWidth >= search.width || targetHeight >= search.height) continue;

      const scaledTemplate = resizeGrayImage(template, targetWidth, targetHeight);

      for (let y = 0; y <= search.height - scaledTemplate.height; y += SCAN_STRIDE) {
        for (let x = 0; x <= search.width - scaledTemplate.width; x += SCAN_STRIDE) {
          const score = ncc(search, scaledTemplate, x, y);
          if (!best || score > best.score) {
            best = { x: x + scaledTemplate.width / 2, y: y + scaledTemplate.height / 2, score };
          }
        }
      }
    }
  }

  if (!best || best.score < MATCH_THRESHOLD) return null;

  // Map the match center back from the downsampled search resolution to the
  // original image's coordinate space, so callers can compare it directly
  // against OCR word bounding boxes (which are reported in that space).
  const scaleX = (originalMeta.width ?? search.width) / search.width;
  const scaleY = (originalMeta.height ?? search.height) / search.height;
  return { x: best.x * scaleX, y: best.y * scaleY, score: best.score };
}
