import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: "/csv-qa/", // Replace 'csv-qa' with your actual repository name
  build: {
    outDir: "dist",
    assetsDir: "assets",
  },
});
