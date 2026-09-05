import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    "ec2-3-6-221-61.ap-south-1.compute.amazonaws.com",
  ],

  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination:
          process.env.BACKEND_URL || "http://localhost:5000/api/:path*",
      },
    ];
  },
};

export default nextConfig;