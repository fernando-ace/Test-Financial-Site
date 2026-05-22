import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  // GitHub Pages project URL: https://USERNAME.github.io/Income-Ladder-Snapshot/
  base: "/Income-Ladder-Snapshot/",
  plugins: [react()],
});
