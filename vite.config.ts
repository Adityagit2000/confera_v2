import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import legacy from "@vitejs/plugin-legacy";

export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    legacy({
      targets: ["defaults", "iOS >= 13", "Safari >= 13"],
      additionalLegacyPolyfills: ["regenerator-runtime/runtime"],
      renderLegacyChunks: true,
      modernPolyfills: true,
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    // Lower target from es2020 to es2019 — removes optional chaining
    // and nullish coalescing from raw output so iOS 13-15 can parse it
    target: ["es2019", "safari13"],
    outDir: "dist",
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ["react", "react-dom", "react-router-dom"],
          supabase: ["@supabase/supabase-js"],
          ui: ["framer-motion", "lucide-react"],
        },
      },
    },
  },
  optimizeDeps: {
    include: ["react", "react-dom", "react-router-dom", "three", "@react-three/fiber", "@react-three/drei"],
  },
  server: {
    host: "::",
    port: 8080,
  },
}));
