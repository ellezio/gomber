import { defineConfig } from "vite";

export default defineConfig(({ mode }) => ({
  build: {
    outDir: "dist",
    lib: {
      entry: mode === "collision" ? "collision-sample/index.ts" : "src/index.ts",
      name: mode === "collision" ? "CollisionSample" : "GameClient",
      formats: ["iife"],
      fileName: () => "bundle.js",
    },
  },
}));
