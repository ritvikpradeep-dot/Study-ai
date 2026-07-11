import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pdf-parse", "pdfjs-dist"],
  env: {
    NEXT_PUBLIC_GOOGLE_AUTH_ENABLED: Boolean(
      process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET
    ).toString(),
  },
};

export default nextConfig;
