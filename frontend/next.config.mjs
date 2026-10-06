/** @type {import('next').NextConfig} */
const backend = process.env.BACKEND_URL ?? "http://localhost:8080";

const nextConfig = {
  reactStrictMode: true,
  // The browser only ever talks to this Next server. Every /api call is
  // proxied server-side to the Java backend, which keeps CORS trivial and
  // makes the app work identically in docker-compose and `npm run dev`.
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${backend}/api/:path*` }];
  },
};

export default nextConfig;
