import { Abi, AbiFunction, Address, CallResult, ContractFunctionName, Hex } from "tevm";
import { SolcStorageLayout, SolcStorageLayoutTypes } from "tevm/bundler/solc";
import { AbiStateMutability, ContractFunctionArgs, toFunctionSignature, trim } from "viem";

import { debug } from "@/debug";
import { exploreStorage } from "@/lib/explore";
import { ExploreStorageConfig, parseConfig } from "@/lib/explore/config";
import { extractPotentialKeys } from "@/lib/explore/mapping";
import { intrinsicDiff, intrinsicSnapshot, storageDiff, storageSnapshot } from "@/lib/trace/access-list";
import { getContracts, getStorageLayout } from "@/lib/trace/storage-layout";
import {
  LabeledStorageAccess,
  StorageAccessTrace,
  TraceStorageAccessOptions,
  TraceStorageAccessTxParams,
  TraceStorageAccessTxWithAbi,
  TraceStorageAccessTxWithData,
  TraceStorageAccessTxWithReplay,
} from "@/lib/trace/types";
import { cleanTrace, createClient /* , uniqueAddresses */, getUnifiedParams } from "@/lib/trace/utils";

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
  args: TraceStorageAccessOptions & TraceStorageAccessTxParams<TAbi, TFunctionName> & { config?: ExploreStorageConfig },
): Promise<Record<Address, StorageAccessTrace>> => {
  const { client, from, to, data, value } = await getUnifiedParams(args);

  // Execute call on local vm with access list generation and trace
  let callResult: CallResult | undefined;
  try {
    callResult = await client.tevmCall({
      from,
      to,
      data,
      value,
      skipBalance: true,
      createAccessList: true,
      addToMempool: true,
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

  // Retrieve information about the contracts for which we need the storage layout
  const contractsInfo = await getContracts({
    client,
    addresses: addresses.filter((address) => storagePreTx[address] && storagePostTx[address]),
    explorers: args.explorers,
  });

  // Map to store storage layouts adapter per contract
  const layouts: Record<Address, SolcStorageLayout> = {};

  // Get layout adapters for each contract
  await Promise.all(
    Object.entries(contractsInfo).map(async ([address, contract]) => {
      // Get storage layout adapter for this contract
      const layout = await getStorageLayout({ ...contract, address: address as Address });
      if (layout) layouts[address as Address] = layout;
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
  const LabeledStorageAccessTrace = addresses.reduce(
    (acc, address) => {
      const storage = { pre: storagePreTx[address], post: storagePostTx[address] };
      const intrinsics = { pre: intrinsicsPreTx[address], post: intrinsicsPostTx[address] };

      // Skip if this address has no relevant data
      if (!intrinsics.pre || !intrinsics.post) {
        debug(`Missing account state information for address ${address}`);
        return acc;
      }

      // For EOAs (accounts without code) we won't have storage data
      const storageTrace = storage.pre && storage.post ? storageDiff(storage.pre, storage.post) : {};

      const layout = layouts[address];
      if (!layout) {
        acc[address] = {
          storage: Object.fromEntries(
            Object.entries(storageTrace).map(([slot, { current, next }]) => [
              `slot_${slot}`,
              {
                name: `slot_${slot}`,
                trace: [
                  cleanTrace({
                    modified: next !== undefined && next !== current,
                    current: { hex: current },
                    next: { hex: next },
                    slots: [slot],
                    path: [],
                    fullExpression: `slot_${slot}`,
                    note: "Could not label this slot access because no layout was found.",
                  }),
                ],
              },
            ]),
          ),
          intrinsic: intrinsicDiff(intrinsics.pre, intrinsics.post),
        };

        return acc;
      }

      // 1. Decode using all known variables with optimized exploration
      const { withLabels, unexploredSlots } = exploreStorage(
        layout,
        storageTrace,
        potentialKeys.map((k) => k.hex),
        parseConfig(args.config),
      );

      // 1. Process results into named variables - convert all results to LabeledStorageAccess format
      const decoded = withLabels.reduce(
        (acc, result) => {
          // Retrieve existing entry or create a new one
          acc[result.name] = acc[result.name] ?? {
            name: result.name,
            type: result.type,
            kind: result.type.startsWith("mapping")
              ? "mapping"
              : result.type.endsWith("]") && result.type.match(/\[\d+\]$/)
                ? "static_array"
                : result.type.endsWith("[]")
                  ? "dynamic_array"
                  : result.type.startsWith("struct")
                    ? "struct"
                    : result.type === "bytes" || result.type === "string"
                      ? "bytes"
                      : "primitive",
            trace: [],
          };

          acc[result.name].trace.push(
            cleanTrace({
              modified: result.next !== undefined && trim(result.next.hex) !== trim(result.current.hex),
              current: result.current,
              next: result.next,
              slots: result.slots,
              path: result.path,
              fullExpression: result.fullExpression,
              note: result.note,
            }),
          );

          return acc;
        },
        {} as Record<string, LabeledStorageAccess<string, string, SolcStorageLayoutTypes>>,
      );

      // 2. Create unknown variables access traces for remaining slots
      const unknownAccess = Object.fromEntries(
        [...unexploredSlots].map((slot) => {
          const current = storageTrace[slot].current;
          const next = storageTrace[slot].next;

          return [
            `slot_${slot}`,
            {
              name: `slot_${slot}`,
              trace: [
                cleanTrace({
                  modified: next !== undefined && next !== current,
                  current: { hex: current },
                  next: { hex: next },
                  slots: [slot],
                  path: [],
                  fullExpression: `slot_${slot}`,
                  note: "Could not label this slot access.",
                }),
              ],
            },
          ];
        }),
      );

      // Return enhanced trace with labels
      acc[address] = {
        storage: { ...decoded, ...unknownAccess },
        intrinsic: intrinsicDiff(intrinsics.pre, intrinsics.post),
      };

      return acc;
    },
    {} as Record<Address, StorageAccessTrace>,
  );

  return LabeledStorageAccessTrace;
};

/**
 * A class that encapsulates the storage access tracing functionality.
 *
 * Allows for creating a reusable tracer with consistent configuration.
 */
export class Tracer {
  private options: TraceStorageAccessOptions & { config?: ExploreStorageConfig };

  /**
   * Creates a new Tracer instance with configuration for tracing storage access.
   *
   * @param options Configuration options for the tracer
   */
  constructor(options: TraceStorageAccessOptions & { config?: ExploreStorageConfig }) {
    this.options = {
      ...options,
      client: options.client ?? createClient(options),
    };

    // Bind 'this' for the traceStorageAccess method to ensure correct context
    // if it were ever destructured or passed as a callback.
    this.traceStorageAccess = this.traceStorageAccess.bind(this);
  }

  /**
   * Traces storage access for a transaction using calldata.
   *
   * Uses the same underlying implementation as the standalone {@link traceStorageAccess} function.
   */
  async traceStorageAccess(txOptions: TraceStorageAccessTxWithData): Promise<Record<Address, StorageAccessTrace>>;

  /**
   * Traces storage access for a transaction using the contract ABI.
   *
   * Uses the same underlying implementation as the standalone {@link traceStorageAccess} function.
   */
  async traceStorageAccess<
    TAbi extends Abi | readonly unknown[] = Abi,
    TFunctionName extends ContractFunctionName<TAbi> = ContractFunctionName<TAbi>,
  >(txOptions: TraceStorageAccessTxWithAbi<TAbi, TFunctionName>): Promise<Record<Address, StorageAccessTrace>>;

  /**
   * Traces storage access for a transaction using a txHash.
   *
   * Uses the same underlying implementation as the standalone {@link traceStorageAccess} function.
   */
  async traceStorageAccess(txOptions: TraceStorageAccessTxWithReplay): Promise<Record<Address, StorageAccessTrace>>;

  /**
   * Traces storage access for a transaction regardless of the parameters.
   *
   * Uses the same underlying implementation as the standalone {@link traceStorageAccess} function.
   */
  async traceStorageAccess(txOptions: TraceStorageAccessTxParams): Promise<Record<Address, StorageAccessTrace>> {
    return traceStorageAccess({
      ...this.options,
      ...txOptions,
    });
  }
}
