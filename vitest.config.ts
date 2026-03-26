import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      // Ensure imports resolve the same way Vite does in dev
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    name: "unit",
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/tests/setup.ts"],
    typecheck: { tsconfig: "./tsconfig.test.json" },
    include: ["src/tests/**/*.test.{ts,tsx}"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      include: ["src/**/*.{ts,tsx}"],
      // tauri.ts is excluded: it is a thin invoke() adapter tested only via
      // integration/e2e — mocking it in unit tests would be circular.
      exclude: ["src/main.tsx", "src/tests/**", "src/**/*.d.ts", "src/lib/tauri.ts"],
      thresholds: {
        lines: 80,
        functions: 75,
        branches: 70,
        statements: 80,
      },
    },
  },
});
