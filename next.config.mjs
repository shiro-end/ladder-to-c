/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ["pdf-to-img", "pdfjs-dist"],
    outputFileTracingIncludes: {
      "/api/parse-pdf": ["./node_modules/pdfjs-dist/**/*"],
    },
  },
};

export default nextConfig;
