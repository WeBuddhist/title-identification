/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        hostname: "s3.amazonaws.com",
      },
      {
        // Public bucket URLs of the form https://<bucket>.s3.amazonaws.com/...
        hostname: "*.s3.amazonaws.com",
      },
      {
        // Region-scoped virtual-hosted URLs, e.g. https://<bucket>.s3.<region>.amazonaws.com/...
        hostname: "*.s3.*.amazonaws.com",
      },
    ],
  },
};

module.exports = nextConfig;
