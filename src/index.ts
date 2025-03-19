import { Address, createMemoryClient, Hex, http, MemoryClient } from "tevm";
import { Common } from "tevm/common";
import { ForkOptions } from "tevm/state";

import {
  AccountDiff,
  createAccountDiff,
  intrinsicDiff,
  intrinsicSnapshot,
  storageDiff,
  storageSnapshot,
} from "@/lib/access-list";
import { getUniqueAddresses } from "@/lib/utils";

/**
 * Options for analyzing storage access patterns during transaction simulation.
 *
 * Note: You will need to provide either a memory client, fork options, or a JSON-RPC URL.
 *
 * @param from - Sender address
 * @param to - Target contract address (optional for contract creation)
 * @param data - Transaction calldata
 * @param client - Use existing memory client (either this or fork/rpcUrl is required)
 * @param fork - Fork configuration for creating a memory client
 * @param rpcUrl - JSON-RPC URL for creating a memory client
 * @param common - EVM chain configuration (improves performance by avoiding fetching chain info)
 */
export type TraceStorageAccessOptions = {
  /** Sender address */
  from: Address;
  /** Target contract address (optional for contract creation) */
  to?: Address;
  /** Transaction calldata */
  data: Hex;

  /** Use existing memory client (either this or fork/rpcUrl is required) */
  client?: MemoryClient;
  /** Fork configuration for creating a memory client */
  fork?: ForkOptions;
  /** JSON-RPC URL for creating a memory client */
  rpcUrl?: string;
  /** EVM chain configuration (improves performance by avoiding fetching chain info) */
  common?: Common;
};

// Export the main diff type for external use
export type StorageAccessTrace = AccountDiff;

/**
 * Analyzes storage access patterns during transaction execution.
 * Identifies which contract slots are read from and written to.
 *
 * @param options - {@link TraceStorageAccessOptions}
 * @returns Promise<{@link StorageAccessTrace}>
 *
 * @example
 * const analysis = await traceStorageAccess({
 *   from: "0x123",
 *   to: "0x456",
 *   data: "0x1234567890",
 *   client: memoryClient,
 * });
 */
export const traceStorageAccess = async (
  options: TraceStorageAccessOptions,
): Promise<Record<Address, StorageAccessTrace>> => {
  const { from, to, data, client: _client, fork, rpcUrl, common } = options;
  if (!_client && !fork && !rpcUrl)
    throw new Error("You need to provide either rpcUrl or fork options that include a transport");

  // Create the tevm client
  const client =
    _client ??
    createMemoryClient({
      common,
      fork: fork ?? {
        transport: http(rpcUrl),
      },
    });

  // Execute call on local vm with access list generation
  const callResult = await client.tevmCall({
    from,
    to,
    data,
    blockTag: "latest",
    skipBalance: true,
    createAccessList: true,
    createTransaction: true,
  });

  // Get all relevant addresses (contract addresses + sender)
  const addresses = [...Object.keys(callResult.accessList ?? {}), from] as Address[];

  // Get the storage and account values before the transaction is mined
  const storagePreTx = await storageSnapshot(client, callResult.accessList ?? {});
  const intrinsicsPreTx = await intrinsicSnapshot(client, addresses);

  // Mine the transaction and get post-state values
  await client.tevmMine({ blockCount: 1 });

  // Get values after the transaction has been included
  const storagePostTx = await storageSnapshot(client, callResult.accessList ?? {});
  const intrinsicsPostTx = await intrinsicSnapshot(client, addresses);

  // Combine results for all addresses that had activity
  const allAddresses = Array.from(
    new Set([...Object.keys(storagePreTx), ...Object.keys(intrinsicsPreTx)]),
  ) as Address[];

  // Process each address without duplicate sorting or find operations
  return allAddresses.reduce(
    (acc, address) => {
      const preTxStorage = storagePreTx[address];
      const postTxStorage = storagePostTx[address];
      const preTxIntrinsics = intrinsicsPreTx[address];
      const postTxIntrinsics = intrinsicsPostTx[address];

      // Skip if this address has no relevant data
      if (!preTxIntrinsics || !postTxIntrinsics)
        throw new Error(`Missing account state information for address ${address}`);

      // For EOAs (accounts without code) we won't have storage data
      const slotsDiff =
        preTxStorage && postTxStorage ? storageDiff(preTxStorage, postTxStorage) : { reads: {}, writes: {} };

      // Compare account state changes
      const accountDiff = intrinsicDiff(preTxIntrinsics, postTxIntrinsics);

      // Combine into complete diff
      acc[address] = createAccountDiff(slotsDiff, accountDiff);
      return acc;
    },
    {} as Record<Address, StorageAccessTrace>,
  );
};
