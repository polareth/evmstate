import fs from "node:fs";
import { mkdir, stat, writeFile } from "node:fs/promises";
import { join } from "path";
import { createCache } from "@tevm/bundler-cache";
import { createMemoryClient } from "tevm";
import { FileAccessObject } from "tevm/bundler";
import { ResolvedCompilerConfig } from "tevm/bundler/config";
import { createSolc, SolcStorageLayout } from "tevm/bundler/solc";
import { EthjsAccount, parseEther } from "tevm/utils";
import { toFunctionSelector } from "viem";
import { beforeEach, vi } from "vitest";

import { ACCOUNTS, CONTRACTS } from "@test/constants";
import { debug } from "@/debug";
import * as storageLayout from "@/lib/trace/storage-layout";

beforeEach(async () => {
  const client = createMemoryClient({ loggingLevel: "warn" });
  // @ts-expect-error type
  globalThis.client = client;

  // Initialize accounts
  const vm = await client.transport.tevm.getVm();
  await Promise.all(
    Object.values(ACCOUNTS).map((account) =>
      vm.stateManager.putAccount(
        account,
        EthjsAccount.fromAccountData({
          balance: parseEther("10"),
          nonce: 0n,
        }),
      ),
    ),
  );

  // Initialize contracts
  await Promise.all(Object.values(CONTRACTS).map((contract) => client.tevmSetAccount(contract)));

  // Setup mocks for contract-related functions
  if (process.env.TEST_ENV !== "staging") setupContractsMock();
});

const config = JSON.parse(fs.readFileSync(join(__dirname, "../tevm.config.json"), "utf8")) as ResolvedCompilerConfig;
const fileAccess: FileAccessObject = {
  writeFileSync: fs.writeFileSync,
  writeFile,
  readFile: (path, encoding) => fs.promises.readFile(path, { encoding }),
  readFileSync: fs.readFileSync,
  exists: async (path) => !!(await fs.promises.stat(path).catch(() => false)),
  existsSync: fs.existsSync,
  statSync: fs.statSync,
  stat,
  mkdirSync: fs.mkdirSync,
  mkdir,
};

const cache = createCache(config.cacheDir, fileAccess, process.cwd());

/**
 * Create a mock for the getContracts function that returns contract information directly from our test contracts rather
 * than fetching from external APIs.
 */
const setupContractsMock = () => {
  // Mock the getContracts function
  vi.spyOn(storageLayout, "getContracts").mockImplementation(async ({ addresses }) => {
    return Object.fromEntries(
      addresses.map((address) => {
        const contract = Object.values(CONTRACTS).find(
          (contract) => contract.address.toLowerCase() === address.toLowerCase(),
        );

        if (!contract) {
          return [
            address,
            {
              sources: [],
              abi: [],
            },
          ];
        }

        const output = cache.readArtifactsSync(`test/contracts/${contract.name ?? ""}.s.sol`);
        return [
          address,
          {
            metadata: {
              name: contract.name,
            },
            sources: Object.fromEntries(
              Object.entries(output?.modules ?? {}).map(([path, source]) => [path, source.code]),
            ),
            abi: Object.values(output?.artifacts ?? {})
              .flatMap((artifact) => artifact.abi)
              .map((item) => {
                if (item.type === "function") {
                  return { ...item, selector: toFunctionSelector(item) };
                } else {
                  return item;
                }
              }),
          },
        ];
      }),
    );
  });

  vi.spyOn(storageLayout, "getStorageLayout").mockImplementation(async ({ address, sources }) => {
    // Return empty layout if we're missing critical information
    if (!sources || sources.length === 0) {
      debug(`Missing compiler info for ${address}. Cannot generate storage layout.`);
      return undefined;
    }

    try {
      const contract = Object.values(CONTRACTS).find(
        (contract) => contract.address.toLowerCase() === address.toLowerCase(),
      );

      if (!contract?.name) {
        debug(`Could not find contract name for address ${address}`);
        return undefined;
      }

      const contractPath = `test/contracts/${contract.name ?? ""}.s.sol`;
      const artifacts = cache.readArtifactsSync(contractPath);

      // Check if the layout exists in the artifacts for this specific contract
      // @ts-expect-error storageLayout does not exist in the artifact
      let layout = artifacts?.artifacts?.[contract.name]?.storageLayout as SolcStorageLayout | undefined;

      // If not found, recompile to get the layout
      if (!layout) {
        const solcInput = artifacts?.solcInput;
        const solc = await createSolc("0.8.23");

        const output = solc.compile({
          language: solcInput?.language ?? "Solidity",
          settings: {
            evmVersion: solcInput?.settings?.evmVersion ?? "paris",
            outputSelection: {
              "*": {
                "*": [
                  ...(solcInput?.settings?.outputSelection["*"]["*"] ?? []),
                  "storageLayout",
                  "evm.bytecode.sourceMap",
                ],
              },
            },
          },
          sources: solcInput?.sources ?? {},
        });

        // Use findMostRelevantLayout to get the layout
        layout = storageLayout.findMostRelevantLayout(output, contract.name);

        if (layout) {
          // Write the updated artifacts back to the cache
          cache.writeArtifactsSync(contractPath, {
            ...artifacts,
            artifacts: {
              ...artifacts?.artifacts,
              [contract.name]: {
                ...artifacts?.artifacts?.[contract.name],
                // @ts-expect-error storageLayout does not exist in the artifact
                storageLayout: layout,
              },
            },
          });
        }
      }

      if (!layout) {
        debug(`Could not find storage layout for contract ${contract.name}`);
        return undefined;
      }

      return {
        storage: layout.storage || [],
        types: layout.types || {},
      };
    } catch (error) {
      debug(`Error generating storage layout for ${address}:`, error);
      return undefined;
    }
  });
};
