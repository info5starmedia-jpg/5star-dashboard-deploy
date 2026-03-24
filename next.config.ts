import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Disable Next.js font optimisation so the build does not attempt to
  // download fonts from external CDNs. The app uses the Tailwind system-font
  // stack which requires no network access at build time.
  optimizeFonts: false,
};

export default nextConfig;
