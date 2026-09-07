import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Boundary 1 (`src/data/load.ts`) reads the committed fixture off disk at request time,
  // which the Next docs' "Reading files: use `process.cwd()`" guidance is written for. File
  // tracing follows *imports*, so JSON that is only named at runtime is not traced into the
  // server bundle unless it is listed here — the load boundary would throw its R-D19 fault in
  // production while passing everywhere else.
  outputFileTracingIncludes: {
    "/*": ["src/fixtures/data/**/*.json"],
  },
};

export default nextConfig;
