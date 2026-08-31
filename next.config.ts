import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  env: {
    NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "",
  },
  async headers() {
    return [
      {
        source: "/vendor/wasm/:path*.wasm",
        headers: [
          { key: "Cache-Control", value: "public, max-age=0, no-transform" },
          { key: "Content-Type", value: "application/wasm" },
        ],
      },
    ];
  },
};

export default nextConfig;
