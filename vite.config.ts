// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, cloudflare (build-only),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... } }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// Para deploy no GitHub Pages, defina VITE_BASE_PATH ao buildar:
//   VITE_BASE_PATH=/nome-do-repo/ bun run build
// O conteúdo de dist/client/ deve ser enviado para o branch gh-pages.
const basePath = process.env.VITE_BASE_PATH || "/";

export default defineConfig({
  vite: {
    base: basePath,
  },
});
