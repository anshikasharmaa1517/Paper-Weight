import type { NextConfig } from "next";
import path from "node:path";
import { getSecurityHeaders } from "./lib/env-config";

const projectRoot = path.resolve(process.cwd());

const nextConfig: NextConfig = {
  transpilePackages: ["react-pdf", "pdfjs-dist"],

  // Pin workspace root (avoids picking up a parent lockfile on local machines)
  outputFileTracingRoot: projectRoot,
  turbopack: {
    root: projectRoot,
  },

  async headers() {
    const securityHeaders = getSecurityHeaders();

    return [
      {
        source: "/(.*)",
        headers: Object.entries(securityHeaders).map(([key, value]) => ({
          key,
          value,
        })),
      },
    ];
  },

  async redirects() {
    if (process.env.NODE_ENV === "production") {
      return [
        {
          source: "/:path*",
          has: [
            {
              type: "header",
              key: "x-forwarded-proto",
              value: "http",
            },
          ],
          destination: "https://:host/:path*",
          permanent: true,
        },
      ];
    }
    return [];
  },

  poweredByHeader: false,

  typescript: {
    ignoreBuildErrors: true,
  },

  compress: true,

  images: {
    remotePatterns: [],
    dangerouslyAllowSVG: false,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },
};

export default nextConfig;
