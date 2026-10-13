import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // tesseract.js spawns a node worker_thread via a script path resolved at
  // runtime; letting webpack bundle it into .next breaks that resolution
  // ("Cannot find module '.../worker-script/node/index.js'"). Keeping it
  // external makes Node `require()` it normally from node_modules instead.
  serverExternalPackages: ["tesseract.js"],
  // Vercel's output file tracer only follows static `require`/`import`
  // graphs, so files tesseract.js reads dynamically at runtime (never
  // through a static require/import) get left out of the deployed
  // serverless function unless listed explicitly here:
  //  - the locally-bundled eng.traineddata.gz (read via langPath)
  //  - tesseract.js-core's .wasm binaries (read via a runtime-resolved
  //    path that picks a SIMD/relaxed-SIMD/plain variant depending on
  //    the CPU's detected features) — omitting these caused a deployed
  //    "ENOENT .../tesseract-core-relaxedsimd.wasm" crash that hung the
  //    request until the function timed out, rather than failing fast.
  outputFileTracingIncludes: {
    "/api/steps/upload": ["./tessdata/**", "./node_modules/tesseract.js-core/**", "./ocrTemplates/**"],
  },
};

export default nextConfig;
