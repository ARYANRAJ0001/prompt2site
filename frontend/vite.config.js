import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: { port: 5173, open: true },
  // Inline PostCSS config so Vite never searches parent folders
  // (macOS can block reading ~/Downloads or ~/Desktop parents).
  css: { postcss: {} },
});
