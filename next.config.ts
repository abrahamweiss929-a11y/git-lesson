import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    resolveAlias: {
      // pdf.js tries to import canvas (not needed in browser)
      canvas: "",
    },
  },
};

export default nextConfig;
