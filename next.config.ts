import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // tesseract.js spawns a node worker_thread via a script path resolved at
  // runtime; letting webpack bundle it into .next breaks that resolution
  // ("Cannot find module '.../worker-script/node/index.js'"). Keeping it
  // external makes Node `require()` it normally from node_modules instead.
  serverExternalPackages: ["tesseract.js"],
};

export default nextConfig;
