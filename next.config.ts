import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // dockerode は ssh2 (native binding) を依存に含むため Next.js のバンドル対象から外し、
  // 実行時に Node.js の require で解決させる。
  serverExternalPackages: ["dockerode", "ssh2", "cpu-features"],
};

export default nextConfig;
