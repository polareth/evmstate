import { Address, createMemoryClient, Hex, http } from "tevm";

import { createAccountDiff, intrinsicDiff, intrinsicSnapshot, storageDiff, storageSnapshot } from "@/lib/access-list";
import { LabeledStorageSlot, StorageAccessTrace, TraceStorageAccessOptions } from "@/lib/types";

import { findStorageSlotLabel, getContracts, getStorageLayout, LabeledStorageSlot as StorageSlotInfo } from "./storage-layout";
import { uniqueAddresses } from "./utils";

// Type for storage slot with labels
export type LabeledStorageAccess = {
  label: string | null;
  match: 'exact' | 'mapping-base' | 'array-base' | null;
  slotInfo: StorageSlotInfo | null;
  value: Hex; // For reads
  oldValue?: Hex; // For writes (previous value)
  newValue?: Hex; // For writes (new value)
};

// Enhanced trace with labels
export type EnhancedStorageAccessTrace = StorageAccessTrace & {
  labeledReads: Record<Hex, LabeledStorageAccess>;
  labeledWrites: Record<Hex, LabeledStorageAccess>;
};

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
): Promise<Record<Address, EnhancedStorageAccessTrace>> => {
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

  // Get contracts' storage layouts
  const filteredContracts = addresses.filter(address => {
    const preTxStorage = storagePreTx[address];
    const postTxStorage = storagePostTx[address];
    return preTxStorage && postTxStorage;
  });

  const contractsInfo = await getContracts({ client, addresses: filteredContracts, explorers });
  
  // Map to store storage layouts per contract
  const storageLayouts: Record<Address, Array<LabeledStorageSlot>> = {};
  
  // Get storage layouts for each contract
  await Promise.all(
    Object.entries(contractsInfo).map(async ([address, contract]) => {
      const layoutResult = await getStorageLayout({ ...contract, address: address as Address });
      if (layoutResult?.labeledSlots) {
        storageLayouts[address as Address] = layoutResult.labeledSlots;
      }
    }),
  );

  // Process each address and create enhanced trace with labels
  const enhancedTrace = addresses.reduce(
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
      const trace = createAccountDiff(slotsDiff, accountDiff);
      
      // Get storage layout for this contract
      const contractLayout = storageLayouts[address];
      
      // Create labeled reads
      const labeledReads: Record<Hex, LabeledStorageAccess> = {};
      if (contractLayout) {
        Object.entries(trace.reads).forEach(([slotHex, { current }]) => {
          const slotLabel = findStorageSlotLabel(slotHex.slice(2), contractLayout);
          labeledReads[slotHex as Hex] = {
            ...slotLabel,
            value: current,
          };
        });
      }
      
      // Create labeled writes
      const labeledWrites: Record<Hex, LabeledStorageAccess> = {};
      if (contractLayout) {
        Object.entries(trace.writes).forEach(([slotHex, { current, next }]) => {
          const slotLabel = findStorageSlotLabel(slotHex.slice(2), contractLayout);
          labeledWrites[slotHex as Hex] = {
            ...slotLabel,
            value: next, // Use the new value as the "value" property
            oldValue: current,
            newValue: next,
          };
        });
      }
      
      // Create enhanced trace with labels
      acc[address] = {
        ...trace,
        labeledReads,
        labeledWrites,
      };
      
      return acc;
    },
    {} as Record<Address, EnhancedStorageAccessTrace>,
  );

  return enhancedTrace;
};
