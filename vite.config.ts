import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The Dark API only answers browsers on Dark's own origins (CORS), so this app never calls it
// directly: the browser requests a same-origin path and the dev server forwards it. `vite preview`
// inherits the same table. A production host must serve these two routes itself; see "Deploying"
// in the README.
//
// The trailing slashes matter: without them "/dark-api" would also match "/dark-api-testnet".
export default defineConfig({
  plugins: [react()],
  // bb.js (the range-proof verifier) is about 4 MB of WebAssembly. It is split into its own chunk
  // and loaded only when a range disclosure is opened, so its size is expected.
  build: { chunkSizeWarningLimit: 4500 },
  server: {
    proxy: {
      "/dark-api/": {
        target: "https://api.darkwallet.cash",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/dark-api/, ""),
      },
      "/dark-api-testnet/": {
        target: "https://api-testnet.darkwallet.cash",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/dark-api-testnet/, ""),
      },
    },
  },
});
