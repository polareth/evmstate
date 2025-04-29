import { Abi, AbiFunction, Address, ContractFunctionName } from "tevm";
import { SolcStorageLayout } from "tevm/bundler/solc";
import { AbiStateMutability, toFunctionSignature } from "viem";

import { debug } from "@/debug";
import { ExploreStorageConfig } from "@/lib/explore/config";
import { labelStateDiff } from "@/lib/explore/label";
import { debugTraceTransaction } from "@/lib/trace/debug";
import { getContracts, getStorageLayout } from "@/lib/trace/storage-layout";
import { LabeledStateDiff, TraceStateBaseOptions, TraceStateOptions, TraceStateTxParams } from "@/lib/trace/types";
import { createClient } from "@/lib/trace/utils";

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
 * @returns Promise<Record<Address, {@link LabeledStateDiff}>> - Storage access trace with labeled slots and labeled
 *   layout access for each touched account
 */
export const traceState = async <
  TAbi extends Abi | readonly unknown[] = Abi,
  TFunctionName extends ContractFunctionName<TAbi> = ContractFunctionName<TAbi>,
>(
  options: TraceStateOptions<TAbi, TFunctionName>,
): Promise<Record<Address, LabeledStateDiff>> => {
  const client = options.client ?? createClient(options);
  const { stateDiff, addresses, newAddresses, structLogs } = await debugTraceTransaction(client, options);
  const uniqueAddresses = [...new Set([...addresses, ...newAddresses])];

  // Debug log showing the trace size and unique stack values
  debug(`Trace contains ${structLogs.length} steps`);
  debug(`${uniqueAddresses.length} accounts touched during the transaction`);

  // Retrieve information about the contracts for which we need the storage layout
  const contractsInfo = await getContracts({
    client,
    addresses: uniqueAddresses.filter((address) => Object.keys(stateDiff[address].storage).length > 0),
    explorers: options.explorers,
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

  // Aggregate functions from all abis to be able to figure out types of args
  let abiFunctions = Object.values(contractsInfo)
    .flatMap((contract) => contract.abi)
    .filter((abi) => abi.type === "function");

  // In case the tx was a contract call with the abi and it could not be fetch, add it so we can decode potential mapping keys
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
  >(txOptions: TraceStateTxParams<TAbi, TFunctionName>): Promise<Record<Address, LabeledStateDiff>> {
    // @ts-expect-error args unknown
    return traceState({
      ...this.options,
      ...txOptions,
    });
  }
}
