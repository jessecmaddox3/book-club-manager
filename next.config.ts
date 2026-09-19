import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages:['@electric-sql/pglite','proper-lockfile','postgres'],
  outputFileTracingIncludes:{'/*':['./club.config.json','./db/migrations/*.sql']},
  outputFileTracingExcludes:{'/*':['./private/**/*','./.local/**/*','./.env*','./artifacts/**/*','./tests/**/*']},
  images: {remotePatterns:[]},
};

export default nextConfig;
