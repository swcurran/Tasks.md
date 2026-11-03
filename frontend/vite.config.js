import { defineConfig } from "vite";
import solidPlugin from "vite-plugin-solid";
import { VitePWA } from 'vite-plugin-pwa';
import generalAssets from "./plugins/general-assets";
import { execSync } from "node:child_process";

// Identifies this build. It's compiled into the page and written to
// version.json, which the server reports, so the help dialog can tell whether
// a tab is running the build the server currently serves.
function getGitCommit() {
  try {
    return execSync("git rev-parse --short HEAD", {
      stdio: ["ignore", "pipe", "ignore"],
    })
      .toString()
      .trim();
  } catch {
    return null;
  }
}
const buildInfo = {
  builtAt: new Date().toISOString(),
  commit: process.env.GIT_COMMIT || getGitCommit() || null,
};

function buildInfoFile() {
  return {
    name: "build-info",
    generateBundle() {
      this.emitFile({
        type: "asset",
        fileName: "version.json",
        source: JSON.stringify(buildInfo),
      });
    },
  };
}

export default defineConfig({
  define: {
    __BUILD_INFO__: JSON.stringify(buildInfo),
  },
  plugins: [
    solidPlugin(),
    generalAssets(),
    buildInfoFile(),
    VitePWA({
      registerType: "autoUpdate",
      workbox: {
        clientsClaim: true,
        skipWaiting: true,
      },
      devOptions: {
        enabled: true,
      },
      base: "",
      manifest: {
        name: "Tasks.md",
        short_name: "Tasks.md",
        description:
          "A self-hosted file based task management board that supports Markdown syntax",
        theme_color: "#1c1c1c",
        background_color: "#1c1c1c",
        icons: [
          {
            src: "favicon/favicon-16x16.png",
            sizes: "16x16",
            type: "image/png",
            purpose: "any maskable",
          },
          {
            src: "favicon/favicon-32x32.png",
            sizes: "32x32",
            type: "image/png",
            purpose: "any maskable",
          },
          {
            src: "favicon/android-chrome-192x192.png",
            sizes: ["144x144", "192x192"],
            type: "image/png",
            purpose: "any maskable",
          },
          {
            src: "favicon/android-chrome-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable",
          },
        ],
      },
    }),
  ],
  base: "",
  server: {
    port: Number(process.env.VITE_PORT),
  },
  build: {
    target: "esnext",
  },
});
