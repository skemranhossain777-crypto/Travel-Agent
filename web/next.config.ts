import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@google/adk"],
  outputFileTracingIncludes: {
    "/api/chat": ["./skills/travel-agent-skill/SKILL.md"],
  },
};

export default nextConfig;
