import { Address, createMemoryClient, Hex, http } from "tevm";

import { debug } from "@/debug";
import { createAccountDiff, intrinsicDiff, intrinsicSnapshot, storageDiff, storageSnapshot } from "@/lib/access-list";
import { extractPotentialValuesFromTrace, findBestStorageSlotLabel } from "@/lib/slot-engine";
import { getContracts, getStorageLayout } from "@/lib/storage-layout";
import {
  LabeledStorageRead,
  LabeledStorageWrite,
  StorageAccessTrace,
  StorageSlotInfo,
  TraceStorageAccessOptions,
} from "@/lib/types";
import { decodeStorageValue, uniqueAddresses } from "@/lib/utils";

/**
 * Analyzes storage access patterns during transaction execution.
 * Identifies which contract slots are read from and written to, with human-readable labels.
 *
 * @param options - {@link TraceStorageAccessOptions}
 * @returns Promise<Record<Address, EnhancedStorageAccessTrace>>
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

  // Execute call on local vm with access list generation and trace
  const callResult = await client.tevmCall({
    from,
    to,
    data,
    blockTag: "latest",
    skipBalance: true,
    createAccessList: true,
    createTransaction: true,
    createTrace: true, // Enable EVM tracing to capture execution details
  });

  // Debug log showing the trace size and unique stack values
  debug(
    `Trace contains ${callResult.trace?.structLogs.length} steps and ${[...new Set(callResult.trace?.structLogs.flatMap((log) => log.stack))].length} unique stack values`,
  );

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
  const filteredContracts = addresses.filter((address) => {
    const preTxStorage = storagePreTx[address];
    const postTxStorage = storagePostTx[address];
    return preTxStorage && postTxStorage;
  });

  const contractsInfo = await getContracts({ client, addresses: filteredContracts, explorers });

  // Map to store storage layouts per contract
  const storageLayouts: Record<Address, Array<StorageSlotInfo>> = {};

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
  // TODO: review
  const labeledTrace = addresses.reduce(
    (acc, address) => {
      const preTxStorage = storagePreTx[address];
      const postTxStorage = storagePostTx[address];
      const preTxIntrinsics = intrinsicsPreTx[address];
      const postTxIntrinsics = intrinsicsPostTx[address];

      // Skip if this address has no relevant data
      if (!preTxIntrinsics || !postTxIntrinsics) {
        console.warn(`Missing account state information for address ${address}`);
        return acc; // Skip this address
      }

      // For EOAs (accounts without code) we won't have storage data
      const slotsDiff =
        preTxStorage && postTxStorage ? storageDiff(preTxStorage, postTxStorage) : { reads: {}, writes: {} };

      // Compare account state changes
      const accountDiff = intrinsicDiff(preTxIntrinsics, postTxIntrinsics);

      // Combine into complete diff
      const trace = createAccountDiff(slotsDiff, accountDiff);

      // Get storage layout for this contract
      const contractLayout = storageLayouts[address];

      // Transaction data for slot labeling
      const txData = {
        data: data,
        to: to,
        from: from,
      };

      // Extract potential key/index values from the execution trace
      const traceLog = callResult.trace?.structLogs || [];

      // Create a slim version of the trace with deduplicated stack values for efficiency
      const dedupedTraceLog = {
        // Deduplicate stack values across all operations
        uniqueStackValues: [...new Set(traceLog.flatMap((log) => log.stack))],
        // Only keep storage-related operations for detailed analysis
        relevantOps: traceLog.filter((log) => ["SLOAD", "SSTORE", "SHA3"].includes(log.op)),
      };

      const potentialValues = extractPotentialValuesFromTrace(dedupedTraceLog, txData);

      debug(`Extracted ${potentialValues.length} unique potential values from the trace`);

      // Create labeled reads
      const labeledReads: Record<Hex, LabeledStorageRead> = {};
      if (contractLayout) {
        Object.entries(trace.reads).forEach(([slotHex, { current }]) => {
          // Find the best label for this slot using our slot engine
          const slotLabel = findBestStorageSlotLabel(slotHex, contractLayout, potentialValues);

          if (slotLabel) {
            // Found a match
            // Decode the value based on its type
            const decodedValue = decodeStorageValue(current, slotLabel.type);

            labeledReads[slotHex as Hex] = {
              label: slotLabel.label,
              current: decodedValue,
              type: slotLabel.type,
              keys: slotLabel.keys,
            };
          } else {
            // No match found, use a fallback label
            const slotNumber = parseInt(slotHex.replace(/^0x0*/, ""), 16);
            const fallbackLabel = isNaN(slotNumber) ? undefined : `var${slotNumber}`;

            // Use uint256 as default type for unknown slots
            const defaultType = "uint256";
            const decodedValue = decodeStorageValue(current, defaultType);

            labeledReads[slotHex as Hex] = {
              label: fallbackLabel,
              current: decodedValue,
              type: defaultType,
            };
          }
        });
      }

      // Create labeled writes
      const labeledWrites: Record<Hex, LabeledStorageWrite> = {};
      if (contractLayout) {
        Object.entries(trace.writes).forEach(([slotHex, { current, next }]) => {
          // Find the best label for this slot using our slot engine
          const slotLabel = findBestStorageSlotLabel(slotHex, contractLayout, potentialValues);

          if (slotLabel) {
            // Found a match
            // Decode both current and next values based on the same type
            const decodedCurrent = decodeStorageValue(current, slotLabel.type);
            const decodedNext = decodeStorageValue(next, slotLabel.type);

            labeledWrites[slotHex as Hex] = {
              label: slotLabel.label,
              current: decodedCurrent,
              next: decodedNext,
              type: slotLabel.type,
              keys: slotLabel.keys,
            };
          } else {
            // No match found, use a fallback label
            const slotNumber = parseInt(slotHex.replace(/^0x0*/, ""), 16);
            const fallbackLabel = isNaN(slotNumber) ? undefined : `var${slotNumber}`;

            // Use uint256 as default type for unknown slots
            const defaultType = "uint256";
            const decodedCurrent = decodeStorageValue(current, defaultType);
            const decodedNext = decodeStorageValue(next, defaultType);

            labeledWrites[slotHex as Hex] = {
              label: fallbackLabel,
              current: decodedCurrent,
              next: decodedNext,
              type: defaultType,
            };
          }
        });
      }

      // Create enhanced trace with labels
      acc[address] = {
        reads: labeledReads,
        writes: labeledWrites,
        intrinsic: trace.intrinsic,
      };

      return acc;
    },
    {} as Record<Address, StorageAccessTrace>,
  );

  return labeledTrace;
};
