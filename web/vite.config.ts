import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { pwaPlugin } from './scripts/pwa.mjs';

export default defineConfig({
  plugins: [react(), pwaPlugin()],
  server: {
    proxy: { "/api": process.env.TELEDRIVE_API_URL || "http://localhost:3000" },
  },
});
