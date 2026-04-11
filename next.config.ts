import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // ✅ REMOVIDO: ignoreBuildErrors - erros de tipo devem ser corrigidos
  reactStrictMode: true,
};

export default nextConfig;
