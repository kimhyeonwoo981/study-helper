/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true, // (옵션) Strict Mode 유지
  eslint: {
    ignoreDuringBuilds: true, // ✅ Vercel 빌드시 ESLint 오류 무시
  },
};

module.exports = nextConfig;
