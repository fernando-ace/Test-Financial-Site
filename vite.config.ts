import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  // GitHub Pages project URL: https://USERNAME.github.io/Client-Financial-Snapshot/
  base: "/Client-Financial-Snapshot/",
  plugins: [react()],
});
