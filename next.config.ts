import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  turbopack: {
    root: __dirname,
  },
  allowedDevOrigins: [
    "localhost",
    "127.0.0.1",
    "192.168.0.5",
    "192.168.0.5.nip.io",
    "192.168.0.32",
    "192.168.0.32.nip.io",
    "192.168.0.45",
    "192.168.0.45.nip.io",
  ],
};

export default nextConfig;
