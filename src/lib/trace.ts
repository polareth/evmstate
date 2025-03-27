import { Abi, AbiFunction, Address, CallResult, ContractFunctionName, Hex } from "tevm";
import { SolcStorageLayoutTypes } from "tevm/bundler/solc";
import { toFunctionSignature } from "viem";

import { debug } from "@/debug";
import { createAccountDiff, intrinsicDiff, intrinsicSnapshot, storageDiff, storageSnapshot } from "@/lib/access-list";
import { StorageLayoutAdapter } from "@/lib/adapter";
import { extractPotentialKeys } from "@/lib/slots/engine";
import { formatLabeledStorageAccess, getContracts, getStorageLayoutAdapter } from "@/lib/storage-layout";
import {
  LabeledStorageAccess,
  StorageAccessTrace,
  TraceStorageAccessOptions,
  TraceStorageAccessTxParams,
} from "@/lib/types";
import { createClient /* , uniqueAddresses */, getUnifiedParams } from "@/lib/utils";

/**
 * Analyzes storage access patterns during transaction execution.
 *
 * Identifies which contract slots are read from and written to, with human-readable labels.
 *
 * Note: If you provide a Tevm client yourself, you're responsible for managing the fork's state; although default
 * mining configuration is "auto", so unless you know what you're doing, it should be working as expected intuitively.
 *
 * @example
 *   const analysis = await traceStorageAccess({
 *     from: "0x123",
 *     to: "0x456",
 *     data: "0x1234567890",
 *     client: memoryClient,
 *   });
 *
 * @param options - {@link TraceStorageAccessOptions}
 * @returns Promise<Record<Address, {@link StorageAccessTrace}>> - Storage access trace with labeled slots and labeled
 *   layout access for each touched account
 */
export const traceStorageAccess = async <
  TAbi extends Abi | readonly unknown[] = Abi,
  TFunctionName extends ContractFunctionName<TAbi> = ContractFunctionName<TAbi>,
>(
  args: TraceStorageAccessOptions & TraceStorageAccessTxParams<TAbi, TFunctionName>,
): Promise<Record<Address, StorageAccessTrace>> => {
  const { client, from, to, data } = await getUnifiedParams(args);

  // Execute call on local vm with access list generation and trace
  let callResult: CallResult | undefined;
  try {
    callResult = await client.tevmCall({
      from,
      to,
      data,
      skipBalance: true,
      createAccessList: true,
      createTransaction: true,
      createTrace: true,
    });

    if (callResult.errors) {
      debug(`EVM exception during call: ${callResult.errors.map((err) => err.message).join(", ")}`);
      throw new Error(callResult.errors.map((err) => err.message).join(", "));
    }
  } catch (err) {
    debug(`Failed to execute call: ${err}`);
    throw err;
  }

  // Debug log showing the trace size and unique stack values
  debug(
    `Trace contains ${callResult.trace?.structLogs.length} steps and ${[...new Set(callResult.trace?.structLogs.flatMap((log) => log.stack))].length} unique stack values`,
  );

  // Get all relevant addresses (contract addresses + sender + target + any created contracts)
  // const addresses = uniqueAddresses([
  //   ...(Object.keys(callResult.accessList ?? {}) as Address[]),
  //   from,
  //   to,
  //   ...((callResult.createdAddresses ?? []) as Address[]),
  // ]);
  // TODO: research to make sure this really includes all relevant addresses but it should (all accounts touched by the tx)
  // currently enabled with createAccessList: true
  const addresses = Object.values(callResult.preimages ?? {}).filter(
    (address) => address !== "0x0000000000000000000000000000000000000000",
  );
  debug(`${addresses.length} accounts touched during the transaction`);

  // Get the storage and account values before the transaction is mined
  const storagePreTx = await storageSnapshot(client, callResult.accessList ?? {});
  const intrinsicsPreTx = await intrinsicSnapshot(client, addresses);

  // Mine the pending transaction to get post-state values
  await client.tevmMine();

  // TODO(later): just use a diff tracer
  // const debugCall = await client.request({
  //   method: "debug_traceTransaction",
  //   params: [
  //     callResult.txHash,
  //     {
  //       tracer: "prestateTracer",
  //       tracerConfig: {
  //         diffMode: true,
  //       },
  //     },
  //   ],
  // });
  // console.log(debugCall);

  // Get values after the transaction has been included
  const storagePostTx = await storageSnapshot(client, callResult.accessList ?? {});
  const intrinsicsPostTx = await intrinsicSnapshot(client, addresses);

  // Get contracts' storage layouts
  const filteredContracts = addresses.filter((address) => {
    const preTxStorage = storagePreTx[address];
    const postTxStorage = storagePostTx[address];
    return preTxStorage && postTxStorage;
  });

  const contractsInfo = await getContracts({ client, addresses: filteredContracts, explorers: args.explorers });

  // Map to store storage layouts adapter per contract
  const layoutAdapters: Record<Address, StorageLayoutAdapter> = {};

  // Get layout adapters for each contract
  await Promise.all(
    Object.entries(contractsInfo).map(async ([address, contract]) => {
      // Get storage layout adapter for this contract
      layoutAdapters[address as Address] = await getStorageLayoutAdapter({ ...contract, address: address as Address });
    }),
  );
  // Extract potential key/index values from the execution trace
  const traceLog = callResult.trace?.structLogs || [];

  // Create a slim version of the trace with deduplicated stack values for efficiency
  const dedupedTraceLog = {
    // Deduplicate stack values across all operations
    uniqueStackValues: [...new Set(traceLog.flatMap((log) => log.stack))],
    // Only keep storage-related operations for detailed analysis
    relevantOps: traceLog.filter((log) => ["SLOAD", "SSTORE", "SHA3"].includes(log.op)),
  };

  // Aggregate functions from all abis to be able to figure out types of args
  // TODO: maybe grab the function def before aggregating abis to no overwrite anything
  let abis = Object.values(contractsInfo)
    .flatMap((contract) => contract.abi)
    .filter((abi) => abi.type === "function");

  // In case the tx was a contract call with the abi and it could not be fetch, add it so we can decode potential mapping keys
  if (args.abi && args.functionName) {
    const functionDef = (args.abi as Abi).find(
      (func) => func.type === "function" && func.name === args.functionName,
    ) as AbiFunction | undefined;
    // @ts-expect-error readonly/mutable types
    if (functionDef) abis.push({ ...functionDef, selector: toFunctionSignature(functionDef) });
  }

  const potentialKeys = extractPotentialKeys(dedupedTraceLog, addresses, abis, data);
  debug(`Extracted ${potentialKeys.length} unique potential values from the trace`);

  // Process each address and create enhanced trace with labels
  const labeledTrace = addresses.reduce(
    (acc, address) => {
      const storage = { pre: storagePreTx[address], post: storagePostTx[address] };
      const intrinsics = { pre: intrinsicsPreTx[address], post: intrinsicsPostTx[address] };

      // Skip if this address has no relevant data
      if (!intrinsics.pre || !intrinsics.post) {
        debug(`Missing account state information for address ${address}`);
        return acc;
      }

      // Create a complete diff
      const trace = createAccountDiff(
        // For EOAs (accounts without code) we won't have storage data
        storage.pre && storage.post ? storageDiff(storage.pre, storage.post) : {},
        // Compare account state changes
        intrinsicDiff(intrinsics.pre, intrinsics.post),
      );

      // Grab the adapter for this contract
      const layoutAdapter = layoutAdapters[address];

      /* ------------------------------------ x ----------------------------------- */
      // TODO: Redesign
      // Current design:
      // Go through each read, and for each go through all known variables to try to decode
      // Same for writes
      // If we can't decode, return a generic variable name
      // New design:
      // Will be just [...Object.keys(trace.contract)]

      // See in the Process how we eliminate slots
      let unexploredSlots: Set<Hex> = new Set([...Object.keys(trace.storage)] as Array<Hex>);

      // variable name -> decoded (+ maybe add slots that contain data?)
      const decodedAccess = Object.fromEntries(
        Object.entries(layoutAdapter ?? {}).flatMap(([_, storageAdapter]) => {
          // Process:
          // (at every step of the process, if there is no slot left in the unexplored set, we can return early)
          // 1. Start with the simplest:
          // a. get the variables with non-computed slots
          //   - primitives
          //   - structs
          //   - bytes and strings
          // b. find out if their slot(s) is(are) included in the trace
          //   - primitives: simple slot lookup
          //   - structs: get the numberOfBytes and lookup for all populated slots
          //     - sort by numberOfBytes low -> high
          // TODO: - later we would also check array & mappings in structs, and do the appropriate lookup
          //   - bytes and strings: get the length (before & after tx, keep the highest) and lookup for all populated slots
          //     - sort by length low -> high
          // c. for each of these, return an array of associated slots that were accessed
          // d. then we can safely eliminate these slots from the unexplored set
          //   - this way, mappings & arrays won't consider them as we know they start at a new slot + colliding with a computed slot is improbable
          // 2. Continue with mappings; for each mapping (sorted lowest -> highest nesting)
          // a. try all potential keys to try to compute slots
          // TODO: - later we would need to consider the value type:
          //       e.g. if it's a struct, get the numberOfBytes and each time add the next slots to the computed one
          //       e.g. if it's an array, fortunately the legth would have changed, so when checking for keys if we get a match we can get the length (pre&post tx) and check for all index slots
          // b. aggregate any slots that were computed (there could be multiple if the mapping was modified multiple times)
          // c. return an array of {keys, slot} (or slots later when we include structs/arrays)
          // d. eliminate these slots from the unexplored set (same reason, improbable to collide)
          // 3. Continue with fixed-size arrays; for each array (sorted lowest -> highest size)
          // a. compute slot at each index (from 0 to length - 1)
          // b. find out if their slot is included in the trace (could be multiple if multiple items were modified)
          // c. return an array of {index, slot}
          // d. eliminate these slots from the unexplored set
          // 4. Continue with dynamic arrays; for each array (sorted lowest -> highest size, after retrieving the highest length from prev & post tx)
          // a.b.c.d. same as fixed-size arrays
          // 5. For all of these, decode the pre/post tx values
          //   - if the value at relevant slots is not modified, only decode once
          // a. primitives: decode using the type directly and extracting relevant bytes if there is an offset
          // b. structs: decode all members extracting relevant bytes with offset & next slots
          //   - might need to get storage for missing—unmodified—members, but probably not as we usually access the entire struct (except if it was done in assembly)
          // c. bytes and strings: decode using the length (pre/post tx) and extracting relevant bytes
          //   - here as well we might be missing some storage if only some part of the variable was modified and it doesn't overlap some other slot
          // d. mappings: decode using the type directly
          // TODO: - later we would need to consider the value type, and route to the appropriate decoder
          //         - we should be able to do some nested decoding: everytime the value type is non primitive, keep decoding from this slot
          // e. arrays: decode using the type directly
          //   - might need to extract relevant bytes if it doesn't occupy the entire slot?
          // 6. Return everything
          //   - for mappings, return an array of {keys, value}
          //   - for arrays, return an array of {indexes, value}

          // TODO: implement

          // storageDiff should be {[slot: Hex]: {current: Hex, next: Hex}} with no regard to writes/reads
          // Attempt to decode in engine for each kind and return the labeled access
          const decodedAccess: [
            LabeledStorageAccess<"map", "mapping(uint256 => mapping(address => bool))">,
            LabeledStorageAccess<"value", "uint256">,
          ] = [
            {
              label: "map",
              type: "mapping(uint256 => mapping(address => bool))" as const,
              trace: [
                {
                  current: true,
                  keys: [
                    { type: "uint256", value: 3n },
                    { type: "address", value: "0x123" },
                  ],
                  modified: false,
                },
              ],
              slots: [],
              kind: "mapping",
            },
            {
              label: "value",
              type: "uint256",
              trace: { current: 5n, next: 6n, modified: true },
              slots: [],
              kind: "primitive",
            },
          ]; // or can be a single one
          decodedAccess.forEach((access) => access.slots.forEach((slot) => unexploredSlots.delete(slot)));

          return decodedAccess.map((access) => [storageAdapter.label, access]);
        }),
      );

      // generic variable name -> undecoded slot value(s)
      const unknownAccess: Record<
        string,
        LabeledStorageAccess<`slot_${string}`, undefined, SolcStorageLayoutTypes>
      > = Object.fromEntries(
        [...unexploredSlots].map((slot) => [
          `slot_${slot.slice(0, 10)}`,
          {
            label: `slot_${slot.slice(0, 10)}`,
            type: undefined,
            trace: { current: "0x", modified: false },
            slots: [slot],
            kind: "primitive",
          },
        ]),
      );
      /* ------------------------------------ x ----------------------------------- */

      // Create labeled access
      const labeledAccess = Object.entries(trace.storage).reduce(
        (acc, [slotHex, access]) => {
          const formatted = formatLabeledStorageAccess({
            access,
            slot: slotHex as Hex,
            adapter: layoutAdapter,
            potentialKeys,
          });

          formatted.forEach((access) => (acc[access.label] = access));
          return acc;
        },
        {} as Record<string, LabeledStorageAccess>,
      );

      // Return enhanced trace with labels
      acc[address] = {
        storage: labeledAccess,
        intrinsic: trace.intrinsic,
      };

      return acc;
    },
    {} as Record<Address, StorageAccessTrace>,
  );

  return labeledTrace;
};

/**
 * A class that encapsulates the storage access tracing functionality.
 *
 * Allows for creating a reusable tracer with consistent configuration.
 */
export class Tracer {
  private client;
  private explorers;

  /**
   * Creates a new Tracer instance with configuration for tracing storage access.
   *
   * @param options Configuration options for the tracer
   */
  constructor(options: TraceStorageAccessOptions) {
    this.client = options.client ?? createClient(options);
    this.explorers = options.explorers;
  }

  /**
   * Traces storage access for a transaction.
   *
   * Uses the same underlying implementation as the standalone {@link traceStorageAccess} function.
   */
  async traceStorageAccess(txOptions: {
    from: Address;
    to: Address;
    data: Hex;
  }): Promise<Record<Address, StorageAccessTrace>> {
    // TODO: do we need to update the fork here? or is the "latest" blockTag enough?
    return traceStorageAccess({
      ...txOptions,
      client: this.client,
      explorers: this.explorers,
    });
  }

  // TODO: overload traceStorageAccess to accept abi, functionName, args
  // TODO: overload traceStorageAccess to accept txHash
}
