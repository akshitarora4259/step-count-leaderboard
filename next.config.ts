import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // tesseract.js spawns a node worker_thread via a script path resolved at
  // runtime; letting webpack bundle it into .next breaks that resolution
  // ("Cannot find module '.../worker-script/node/index.js'"). Keeping it
  // external makes Node `require()` it normally from node_modules instead.
  serverExternalPackages: ["tesseract.js"],
  // Vercel's output file tracer only follows static `require`/`import`
  // graphs, so the locally-bundled eng.traineddata.gz (read dynamically by
  // tesseract.js via langPath, not imported) must be listed explicitly or
  // it gets left out of the deployed serverless function.
  outputFileTracingIncludes: {
    "/api/steps/upload": ["./tessdata/**"],
  },
};

export default nextConfig;
