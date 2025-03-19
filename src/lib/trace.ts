import { Address, createMemoryClient, http } from "tevm";

import { createAccountDiff, intrinsicDiff, intrinsicSnapshot, storageDiff, storageSnapshot } from "@/lib/access-list";
import { StorageAccessTrace, TraceStorageAccessOptions } from "@/lib/types";

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

  // Get all relevant addresses (contract addresses + sender + target + any created contracts)
  const addresses = Array.from(
    new Set([...Object.keys(callResult.accessList ?? {}), from, to, ...(callResult.createdAddresses ?? [])]),
  ) as Address[];

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
