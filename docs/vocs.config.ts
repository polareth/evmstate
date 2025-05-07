import fs from "node:fs";
import path from "node:path";
import { vitePluginTevm } from "tevm/bundler/vite-plugin";
import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vocs";

export default defineConfig({
  title: "evmstate",
  description:
    "A TypeScript library for tracing, and visualizing EVM state changes with detailed human-readable labeling.",
  titleTemplate: "%s — evmstate",
  basePath: "/",
  baseUrl: "https://evmstate.polareth.org",
  editLink: {
    pattern: "https://github.com/polareth/evmstate/edit/main/docs/pages/:path",
    text: "Suggest edit on GitHub",
  },
  iconUrl: {
    dark: "/icon-dark.png",
    light: "/icon-light.png",
  },
  logoUrl: {
    dark: "/logo-dark.png",
    light: "/logo-light.png",
  },
  markdown: {
    code: {
      themes: {
        dark: "poimandres",
        light: JSON.parse(fs.readFileSync(path.join(__dirname, "themes/theme-light.json"), "utf8")),
      },
    },
  },
  ogImageUrl: "https://vocs.dev/api/og?logo=%logo&title=%title&description=%description",
  rootDir: ".",
  socials: [
    { icon: "github", link: "https://github.com/polareth" },
    { icon: "x", link: "https://twitter.com/polarethorg" },
    { icon: "telegram", link: "https://t.me/polarzer0" },
    { icon: "warpcast", link: "https://warpcast.com/polarzero" },
  ],
  sidebar: [
    {
      text: "Getting started",
      link: "/introduction",
    },
    {
      text: "Guides",
      collapsed: false,
      items: [
        {
          text: "Installation",
          link: "/guides/installation",
        },
        {
          text: "Basic usage",
          link: "/guides/basic-usage",
        },
        {
          text: "Examples",
          link: "/guides/usage-examples",
        },
      ],
    },
    {
      text: "API",
      collapsed: false,
      link: "/api",
      items: [
        {
          text: "traceState",
          link: "/api/trace-state",
        },
        {
          text: "Tracer",
          link: "/api/tracer",
        },
        {
          text: "watchState",
          link: "/api/watch-state",
        },
      ],
    },
    {
      text: "Reference",
      collapsed: false,
      items: [
        {
          text: "Output format",
          link: "/reference/output-format",
        },
        {
          text: "Storage types",
          link: "/reference/storage-types",
        },
      ],
    },
    {
      text: "Playground",
      collapsed: false,
      link: "/playground",
    },
  ],
  topNav: [
    { text: "Getting started", link: "/introduction" },
    { text: "Playground", link: "/playground" },
    { text: "Github", link: "https://github.com/polareth/evmstate" },
  ],
  // twoslash: {
  //   compilerOptions: {
  //     paths: {
  //       "@polareth/evmstate": ["dist"],
  //       "@polareth/evmstate/react": ["dist/react"],
  //     },
  //   },
  // },
  vite: {
    plugins: [vitePluginTevm({ solc: "0.8.23" }), tsconfigPaths()],
  },
});
