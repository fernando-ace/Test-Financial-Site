import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  // GitHub Pages project URL: https://USERNAME.github.io/Test-Financial-Site/
  base: "/Test-Financial-Site/",
  plugins: [react()],
});
