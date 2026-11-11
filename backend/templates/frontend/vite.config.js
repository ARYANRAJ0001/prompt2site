import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // Relative paths so the site works from any folder or host.
  base: "./",
  // Inline PostCSS config: stops Vite searching parent folders.
  css: { postcss: {} },
});
