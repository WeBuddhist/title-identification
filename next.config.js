/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    // Scoped to the bucket the tasks actually live in. A new bucket needs a
    // new entry here, otherwise next/image rejects the URL with a 400.
    remotePatterns: [
      {
        protocol: "https",
        hostname: "s3.us-east-1.amazonaws.com",
        pathname: "/monlam.ai.ocr/**",
      },
      {
        protocol: "https",
        hostname: "monlam.ai.ocr.s3.us-east-1.amazonaws.com",
        pathname: "/**",
      },
    ],
    // The source scans are ~18 MP. The preview is capped at 40vh, so widths
    // above 1920 only cost memory on the 512 MB instance.
    deviceSizes: [640, 828, 1080, 1920],
    // AVIF encoding costs several times more CPU than webp for these.
    formats: ["image/webp"],
    // S3 serves these without Cache-Control, so Next would otherwise fall back
    // to a 60s TTL and re-optimize the same unchanging scan all day.
    minimumCacheTTL: 60 * 60 * 24 * 30,
  },
};

module.exports = nextConfig;
