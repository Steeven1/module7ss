/**
 * Vite multi-página (MPA): varias apps en subcarpetas con un solo build.
 * - Desarrollo: raíz abre index.html (enlace a cada calculadora).
 * - Build: genera dist/index.html, dist/calculadora-.../index.html, etc.
 *
 * @see https://vitejs.dev/guide/build.html#multi-page-app
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const granEscalaHtml = path.resolve(__dirname, "calculadora-tratamiento-gran-escala/index.html");
const sancionesHtml = path.resolve(__dirname, "calculadora-sanciones-spdp/index.html");

export default defineConfig({
  root: __dirname,
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        index: path.resolve(__dirname, "index.html"),
        granEscala: granEscalaHtml,
        sanciones: sancionesHtml
      }
    }
  }
});
