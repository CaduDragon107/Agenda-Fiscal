import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    server: {
      deps: {
        // Force next-auth (and its bare "next/server" / "next/headers"
        // imports) through Vite's resolver so the aliases below apply —
        // by default these packages are externalized and resolved by
        // plain Node ESM, which cannot resolve extensionless subpaths.
        inline: [/next-auth/, /@auth\/core/],
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      // next-auth v5 imports bare "next/server" and "next/headers" (no
      // extension) which Node ESM cannot resolve because the `next`
      // package has no `exports` map for these subpaths — alias them to
      // the concrete .js files so vitest can resolve them.
      "next/server": path.resolve(__dirname, "./node_modules/next/server.js"),
      "next/headers": path.resolve(__dirname, "./node_modules/next/headers.js"),
    },
  },
});
