import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({plugins:[react()],build:{outDir:".tools/ponto-review-preview",rollupOptions:{input:"e2e/fixtures/ponto-review.html"}}});
