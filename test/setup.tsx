import fs from "node:fs";
import { mkdir, stat, writeFile } from "node:fs/promises";
import { join } from "path";
import { createCache } from "@tevm/bundler-cache";
import { createMemoryClient } from "tevm";
import type { Abi, ContractFunctionName } from "tevm";
import { type FileAccessObject } from "tevm/bundler";
import { type ResolvedCompilerConfig } from "tevm/bundler/config";
import { EthjsAccount, parseEther } from "tevm/utils";
import { toFunctionSelector } from "viem";
import { beforeEach, vi } from "vitest";

import { ACCOUNTS, CONTRACTS } from "@test/constants.js";
import type { TraceStateBaseOptions, TraceStateOptions, TraceStateTxParams, WatchStateOptions } from "@/index.js";
import * as react from "@/lib/react/index.js";
import { createSolc, type SolcStorageLayout } from "@/lib/solc.js";
import * as trace from "@/lib/trace/index.js";
import * as storageLayout from "@/lib/trace/storage-layout.js";
import * as watch from "@/lib/watch/index.js";
import { logger } from "@/logger.js";
import { useMemo } from "react";
import { TracerContext } from "@/lib/react/lib.js";

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
      logger.error(`Missing compiler info for ${address}. Cannot generate storage layout.`);
      return undefined;
    }

    try {
      const contract = Object.values(CONTRACTS).find(
        (contract) => contract.address.toLowerCase() === address.toLowerCase(),
      );

      if (!contract?.name) {
        logger.error(`Could not find contract name for address ${address}`);
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
        logger.error(`Could not find storage layout for contract ${contract.name}`);
        return undefined;
      }

      return {
        storage: layout.storage || [],
        types: layout.types || {},
      };
    } catch (error) {
      logger.error(`Error generating storage layout for ${address}:`, error);
      return undefined;
    }
  });

  // Add a mock for tracing functions to strip metadata from bytecode
  const originalTraceState = trace.traceState;
  const originalWatchState = watch.watchState;
  const mockTraceState = async (params: TraceStateOptions) => stripMetadataFromTrace(await originalTraceState(params));
  const mockWatchState = async (params: WatchStateOptions) => {
    return await originalWatchState({
      ...params,
      onStateChange: (state) => {
        params.onStateChange(stripMetadataFromTrace(state));
      },
    });
  };
  class mockTracer extends trace.Tracer {
    constructor(options: TraceStateBaseOptions) {
      super(options);
    }

    override traceState = async <
      TAbi extends Abi | readonly unknown[] = Abi,
      TFunctionName extends ContractFunctionName<TAbi> = ContractFunctionName<TAbi>,
    >(
      txOptions: TraceStateTxParams<TAbi, TFunctionName>,
    ) => stripMetadataFromTrace(await super.traceState(txOptions));
  }

  // Strip metadata from bytecode, as it will be different for each environment and break the snapshot tests (different paths to contract files)
  vi.spyOn(trace, "traceState").mockImplementation(async (params) => mockTraceState(params as TraceStateOptions));
  vi.spyOn(watch, "watchState").mockImplementation(async (params) => mockWatchState(params));
  vi.spyOn(trace, "Tracer").mockImplementation((options) => new mockTracer(options));
  vi.spyOn(react, "TracerProvider").mockImplementation(({ children, ...options }) => {
    // Memoize the Tracer instance to avoid recreating it on every render unless the options change.
    const tracer = useMemo(
      () => new mockTracer(options),
      [options.client, options.rpcUrl, options.common, options.explorers, options.config],
    );

    return <TracerContext.Provider value={tracer}>{children}</TracerContext.Provider>;
  });
};

/**
 * Recursively processes a trace result to strip metadata hashes from bytecode while preserving compiler version
 * information.
 *
 * This prevents slightly different snapshots depending on test environment just due to a different path structure.
 */
function stripMetadataFromTrace(obj: any): any {
  if (!obj) return obj;

  // Process each address in the trace
  for (const address of Object.keys(obj)) {
    const addressData = obj[address];

    // Process code.current & code.next if they exist and are a hex string
    ["current", "next"].forEach((key) => {
      if (
        addressData.code?.[key] &&
        typeof addressData.code[key] === "string" &&
        addressData.code[key].startsWith("0x")
      ) {
        addressData.code[key] = stripMetadataHash(addressData.code[key]);
      }
    });
  }

  return obj;
}

/**
 * Replaces the metadata hash in Solidity bytecode with zeros while preserving compiler info Format can vary but
 * typically ends with something like: a2646970667358221220...64736f6c634300081c0033
 */
function stripMetadataHash(bytecode: string): string {
  // Look for the solc version marker which appears at the end
  // 64736f6c6343 = hex for "solc43"
  // followed by 6 digits for version (e.g., 00081c)
  // and 0033 as end marker
  const solcMarker = "64736f6c6343";
  const endMarker = "0033";

  // Find the last occurrence of the solc marker
  const solcIndex = bytecode.lastIndexOf(solcMarker);

  if (solcIndex === -1) return bytecode;

  // Check if we have the expected pattern: solcMarker + 6 digits + endMarker
  const expectedEnd = solcIndex + solcMarker.length + 6 + endMarker.length;

  // If the pattern doesn't match or it's not at the end, return original
  if (expectedEnd !== bytecode.length || !bytecode.endsWith(endMarker)) {
    console.log("Bytecode doesn't match expected pattern:", bytecode.slice(-100));
    return bytecode;
  }

  // Find the start of the IPFS hash (a264697066735822...)
  // This typically appears before the solc marker
  const ipfsMarker = "a264697066735822";
  const ipfsIndex = bytecode.lastIndexOf(ipfsMarker, solcIndex);

  if (ipfsIndex === -1) {
    // If no IPFS marker, just zero out a fixed length before the solc marker
    const hashStartIndex = Math.max(0, solcIndex - 64);
    const zeroFill = "0".repeat(solcIndex - hashStartIndex);
    return bytecode.substring(0, hashStartIndex) + zeroFill + bytecode.substring(solcIndex);
  }

  // Zero out the entire metadata section from IPFS marker to the end
  const zeroFill = "0".repeat(bytecode.length - ipfsIndex);
  return bytecode.substring(0, ipfsIndex) + zeroFill;
}
