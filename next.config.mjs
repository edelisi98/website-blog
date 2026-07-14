import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

initOpenNextCloudflareForDev();

const basePath = process.env.BASE_URL || "/resource-api";

/** @type {import('next').NextConfig} */
const nextConfig = {
  basePath,
  assetPrefix: process.env.ASSETS_PREFIX || basePath,
  reactStrictMode: true,
};

export default nextConfig;
