import { defineConfig } from "vite-plus";

export default defineConfig({
  build: {
    lib: {
      entry: {
        cli: "src/cli.ts",
        index: "src/index.ts",
      },
      formats: ["es"],
      fileName: "[name]",
    },
    rollupOptions: {
      external: ["node:fs", "node:path", "node:os", "node:child_process", "node:crypto"],
    },
    target: "node20",
    outDir: "dist",
  },
  staged: {
    "*": "vp check --fix",
  },
  lint: { options: { typeAware: true, typeCheck: true } },
});
