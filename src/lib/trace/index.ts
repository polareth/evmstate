import { type Abi, type AbiFunction, type Address, type ContractFunctionName } from "tevm";
import type { abi } from "@shazow/whatsabi";
import { toFunctionSignature } from "viem";

import { type ExploreStorageConfig } from "@/lib/explore/config.js";
import { labelStateDiff } from "@/lib/explore/label.js";
import { type SolcStorageLayout } from "@/lib/solc.js";
import { debugTraceTransaction } from "@/lib/trace/debug.js";
import { TraceStateResult } from "@/lib/trace/result.js";
import { getContracts, getStorageLayout } from "@/lib/trace/storage-layout.js";
import type { LabeledState, TraceStateBaseOptions, TraceStateOptions, TraceStateTxParams } from "@/lib/trace/types.js";
import { createClient } from "@/lib/trace/utils.js";
import { logger } from "@/logger.js";

/**
 * Analyzes storage access patterns during transaction execution.
 *
 * Identifies which contract slots are read from and written to, with human-readable labels.
 *
 * Note: If you provide a Tevm client yourself, you're responsible for managing the fork's state; although default
 * mining configuration is "auto", so unless you know what you're doing, it should be working as expected intuitively.
 *
 * Note: your RPC will need to support `debug_traceTransaction`, which we use to get the pre/post state diff.
 *
 * @example
 *   const analysis = await traceState({
 *     from: "0x123",
 *     to: "0x456",
 *     data: "0x1234567890",
 *     client: memoryClient,
 *   });
 *
 * @param options - {@link TraceStateOptions}
 * @returns Promise<Record<Address, {@link LabeledState}>> - Storage access trace with labeled slots and labeled layout
 *   access for each touched account
 */
export const traceState = async <
  TAbi extends Abi | readonly unknown[] = Abi,
  TFunctionName extends ContractFunctionName<TAbi> = ContractFunctionName<TAbi>,
>(
  options: TraceStateOptions<TAbi, TFunctionName>,
): Promise<TraceStateResult> => {
  const client = options.client ?? createClient(options);
  const { fetchStorageLayouts = true, fetchContracts = true } = options;
  const { stateDiff, addresses, newAddresses, structLogs } = await debugTraceTransaction(client, options);
  const uniqueAddresses = [...new Set([...addresses, ...newAddresses])];

  // Debug log showing the trace size and unique stack values
  logger.log(`Trace contains ${structLogs.length} steps`);
  logger.log(`${uniqueAddresses.length} accounts touched during the transaction`);

  // Map to store storage layouts adapter per contract
  const layouts: Record<Address, SolcStorageLayout> = Object.fromEntries(
    Object.entries(options.storageLayouts ?? {}).map(([address, layout]) => [
      address.toLowerCase(),
      layout as SolcStorageLayout,
    ]),
  );
  // Functions from abis of touched contracts
  let abiFunctions: Array<abi.ABIFunction> = [];

  // Retrieve information about the contracts for which we need the storage layout
  if (fetchContracts || fetchStorageLayouts) {
    const contractsInfo = await getContracts({
      client,
      addresses: uniqueAddresses.filter((address) => Object.keys(stateDiff[address].storage).length > 0),
      explorers: options.explorers,
    });

    // Get layout adapters for each contract
    if (fetchStorageLayouts) {
      await Promise.all(
        Object.entries(contractsInfo).map(async ([address, contract]) => {
          // Get storage layout adapter for this contract
          const layout = await getStorageLayout({ ...contract, address: address as Address });
          if (layout) layouts[address.toLowerCase() as Address] = layout;
        }),
      );
    }

    // Aggregate functions from all abis to be able to figure out types of args
    abiFunctions = Object.values(contractsInfo)
      .flatMap((contract) => contract.abi)
      .filter((abi) => abi.type === "function");
  }

  // In case the tx was a contract call with the abi, add it so we can decode potential mapping keys
  if (options.abi && options.functionName) {
    const functionDef = (options.abi as Abi).find(
      (func) => func.type === "function" && func.name === options.functionName,
    ) as AbiFunction | undefined;
    // @ts-expect-error readonly/mutable types
    if (functionDef) abiFunctions.push({ ...functionDef, selector: toFunctionSignature(functionDef) });
  }

  return labelStateDiff({ stateDiff, layouts, uniqueAddresses, structLogs, abiFunctions, options });
};

/**
 * A class that encapsulates the storage access tracing functionality.
 *
 * Allows for creating a reusable tracer with consistent configuration.
 *
 * @unsupported - This class should not be used yet, as rebase mode is not available yet. Meaning that in the case of a fork client, it won't follow the state of the fork. For now, you should use the `traceState` function directly, and refork in case you want to use the latest state of the forked chain.
 */
export class Tracer {
  private options: TraceStateBaseOptions & { config?: ExploreStorageConfig };

  /**
   * Creates a new Tracer instance with configuration for tracing storage access.
   *
   * @param options Configuration options for the tracer
   */
  constructor(options: TraceStateBaseOptions & { config?: ExploreStorageConfig }) {
    this.options = {
      ...options,
      client: options.client ?? createClient(options),
    };

    // Bind 'this' for the traceState method to ensure correct context
    // if it were ever destructured or passed as a callback.
    this.traceState = this.traceState.bind(this);
  }

  /**
   * Traces storage access for a transaction.
   *
   * Uses the same underlying implementation as the standalone {@link traceState} function.
   */
  async traceState<
    TAbi extends Abi | readonly unknown[] = Abi,
    TFunctionName extends ContractFunctionName<TAbi> = ContractFunctionName<TAbi>,
  >(txOptions: TraceStateTxParams<TAbi, TFunctionName>): Promise<TraceStateResult> {
    // @ts-expect-error args unknown
    return traceState({
      ...this.options,
      ...txOptions,
    });
  }
}
