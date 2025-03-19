import { Address, createMemoryClient, http } from "tevm";

import { createAccountDiff, intrinsicDiff, intrinsicSnapshot, storageDiff, storageSnapshot } from "@/lib/access-list";
import { StorageAccessTrace, TraceStorageAccessOptions } from "@/lib/types";

import { getContracts, getStorageLayout } from "./storage-layout";
import { uniqueAddresses } from "./utils";

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
  const { from, to, data, client: _client, fork, rpcUrl, common, explorers } = options;
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
  const addresses = uniqueAddresses([
    ...(Object.keys(callResult.accessList ?? {}) as Address[]),
    from,
    to,
    ...((callResult.createdAddresses ?? []) as Address[]),
  ]);

  // Get the storage and account values before the transaction is mined
  const storagePreTx = await storageSnapshot(client, callResult.accessList ?? {});
  const intrinsicsPreTx = await intrinsicSnapshot(client, addresses);

  // Mine the transaction and get post-state values
  await client.tevmMine({ blockCount: 1 });

  // Get values after the transaction has been included
  const storagePostTx = await storageSnapshot(client, callResult.accessList ?? {});
  const intrinsicsPostTx = await intrinsicSnapshot(client, addresses);

  // Process each address without duplicate sorting or find operations
  const trace = addresses.reduce(
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

  // Filter out contracts that have no storage writes or reads (will also filter out EOAs)
  const filteredContracts = Object.keys(trace).filter(
    (address) =>
      Object.keys(trace[address as Address].writes).length > 0 ||
      Object.keys(trace[address as Address].reads).length > 0,
  ) as Address[];

  const res = await getContracts({ client, addresses: filteredContracts, explorers });
  await Promise.all(
    Object.entries(res).map(async ([address, contract]) => {
      await getStorageLayout({ ...contract, address: address as Address });
    }),
  );

  return trace;
};
