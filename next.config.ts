import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
  },
  allowedDevOrigins: ["localhost", "127.0.0.1", "192.168.0.32", "192.168.0.32.nip.io"],
};

export default nextConfig;
