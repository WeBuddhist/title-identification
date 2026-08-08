/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    // Covers both S3 URL styles: path-style (https://s3.<region>.amazonaws.com/<bucket>/...)
    // and virtual-hosted (https://<bucket>.s3.<region>.amazonaws.com/...), with or
    // without a region segment. Next only allows wildcards at the start of a hostname.
    remotePatterns: [
      {
        hostname: "**.amazonaws.com",
      },
      {
        hostname: "amazonaws.com",
      },
    ],
  },
};

module.exports = nextConfig;
