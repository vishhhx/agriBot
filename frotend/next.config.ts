import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: process.env.BACKEND_URL || "http://3.6.221.61:5000/api/:path*",
      },
    ];
  },
};

export default nextConfig;
