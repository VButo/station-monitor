import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  /* config options here */
  turbopack: {
    root: path.resolve(__dirname), // Explicitly set turbopack root to frontend directory
  },
};

export default nextConfig;
