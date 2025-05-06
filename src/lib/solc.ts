import type { Releases, Solc } from "tevm/bundler/solc";

export type {
  SolcStorageLayout,
  SolcStorageLayoutMappingType,
  SolcStorageLayoutTypes,
  SolcSettings,
} from "tevm/bundler/solc";
export type { Releases };

// TODO: use worker on browser
// https://github.com/ethereum/remix-project/tree/86034e4011892eb38264a26880020e271954a05f/libs/remix-solidity/src/lib/es-web-worker
// https://github.com/DadeKuma/nextjs-solidity-browser-compiler/tree/main/src/sol
export const createSolc = async (release: keyof Releases): Promise<Solc> => {
  if (typeof window !== "undefined") {
    throw new Error("createSolc is not available in the browser");
  }
  return import("tevm/bundler/solc").then(({ createSolc }) => createSolc(release));
};

export const getReleases = async () => {
  if (typeof window !== "undefined") {
    throw new Error("getReleases is not available in the browser");
  }
  return import("tevm/bundler/solc").then(({ releases }) => releases);
};
