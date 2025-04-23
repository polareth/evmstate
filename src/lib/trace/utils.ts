import {
  Abi,
  BlockTag,
  ContractFunctionName,
  createMemoryClient,
  encodeFunctionData,
  Hex,
  http,
  MemoryClient,
} from "tevm";
import { Common } from "tevm/common";

import { debug } from "@/debug";
import { ExploreStorageConfig } from "@/lib/explore/config";
import { TraceStorageAccessOptions, TraceStorageAccessTxParams, TraceStorageAccessTxWithData } from "@/lib/trace/types";

/** Creates a Tevm client from the provided options */
export const createClient = (options: {
  rpcUrl?: string;
  common?: Common;
  blockTag?: BlockTag | bigint;
}): MemoryClient => {
  const { rpcUrl, common, blockTag } = options;
  if (!rpcUrl) throw new Error("You need to provide a rpcUrl if you don't provide a client directly");

  return createMemoryClient({
    common,
    fork: {
      transport: http(rpcUrl),
      blockTag: blockTag ?? "latest",
    },
    miningConfig: { type: "manual" },
  });
};

export const getUnifiedParams = async <
  TAbi extends Abi | readonly unknown[] = Abi,
  TFunctionName extends ContractFunctionName<TAbi> = ContractFunctionName<TAbi>,
>(
  args: TraceStorageAccessOptions & TraceStorageAccessTxParams<TAbi, TFunctionName> & { config?: ExploreStorageConfig },
): Promise<TraceStorageAccessTxWithData & { client: MemoryClient }> => {
  const { client: _client, rpcUrl, common } = args;

  // Create the tevm client
  const client = _client ?? createClient({ rpcUrl, common });

  // Return early if the tx was already provided in calldata format
  if (args.from && args.data) return { client, from: args.from, to: args.to, data: args.data, value: args.value };

  // Encode calldata if the contract call was provided (abi, functionName, args)
  if (args.from && args.to && args.abi && args.functionName && args.args) {
    try {
      // @ts-expect-error complex union type not exactly similar
      const data = encodeFunctionData(args);
      return { client, from: args.from, to: args.to, data, value: args.value };
    } catch (err) {
      debug(`Failed to encode function data: ${err}`);
      throw err;
    }
  }

  // If we provide a value but no txHash, it's a simple transfer
  if (args.value && !args.txHash) return { client, from: args.from, to: args.to, value: args.value };

  // In this case, we need to replay the transaction
  if (!args.txHash)
    throw new Error("You need to provide a txHash if you don't provide the transaction data or contract call");

  // If we're replaying a transaction, extract the from, to, and data from the transaction
  try {
    const tx = await client.getTransaction({ hash: args.txHash });

    // Duplicate the client but fork before the transaction's block
    const clientBeforeTx = createMemoryClient({
      ...client,
      fork: {
        transport: client.transport,
        // Ideally we'd want to fork just right before that tx as some same-block txs can impact the state
        blockTag: tx.blockNumber > 0 ? tx.blockNumber - BigInt(1) : BigInt(0),
      },
    });

    return {
      client: clientBeforeTx,
      from: tx.from,
      to: tx.to ?? undefined,
      // TODO: remove when correctly formatted (tx in block mined here has data instead of input)
      // @ts-expect-error Property 'data' does not exist on type Transaction
      data: tx.input ? (tx.input as Hex) : (tx.data as Hex),
      value: tx.value,
    };
  } catch (err) {
    debug(`Failed to get transaction for replaying ${args.txHash}: ${err}`);
    throw err;
  }
};

/** A helper function to clean up trace objects by removing undefined or zero values */
export const cleanTrace = (obj: any) => {
  const { current, next, note, ...rest } = obj;
  let trace = { ...rest };

  // Only include note if it exists
  if (note) trace.note = note;

  // Same for current and next
  trace.current = { hex: current.hex };
  if (current.decoded !== undefined) trace.current = { hex: current.hex, decoded: current.decoded };

  if (next && rest.modified) {
    trace.next = { hex: next.hex };
    if (next.decoded !== undefined) trace.next = { hex: next.hex, decoded: next.decoded };
  }

  return trace;
};
