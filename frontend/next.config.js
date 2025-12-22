/** @type {import('next').NextConfig} */
const backendBaseUrl = (process.env.API_BASE_URL || "http://localhost:8080").replace(/\/$/, "");

const nextConfig = {
  reactStrictMode: true,
  experimental: {
    webpackBuildWorker: false
  },
  async rewrites() {
    return [
      { source: "/api/:path*", destination: `${backendBaseUrl}/api/:path*` },
      { source: "/actuator/:path*", destination: `${backendBaseUrl}/actuator/:path*` },
      { source: "/v3/api-docs/:path*", destination: `${backendBaseUrl}/v3/api-docs/:path*` },
      { source: "/swagger-ui/:path*", destination: `${backendBaseUrl}/swagger-ui/:path*` },
      { source: "/swagger-ui.html", destination: `${backendBaseUrl}/swagger-ui.html` }
    ];
  }
};

module.exports = nextConfig;
