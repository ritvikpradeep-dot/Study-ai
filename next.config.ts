import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pdf-parse", "pdfjs-dist", "@napi-rs/canvas"],
  outputFileTracingIncludes: {
    "/api/documents": ["./node_modules/@napi-rs/canvas/**/*"],
  },
  env: {
    NEXT_PUBLIC_GOOGLE_AUTH_ENABLED: Boolean(
      process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET
    ).toString(),
  },
};

export default nextConfig;
