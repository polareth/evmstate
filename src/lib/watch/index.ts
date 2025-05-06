import { type Address } from "tevm/utils";
import { abi } from "@shazow/whatsabi";
import { toFunctionSignature } from "viem";

import { labelStateDiff } from "@/lib/explore/label.js";
import { type DeepReadonly } from "@/lib/explore/types.js";
import { type SolcStorageLayout } from "@/lib/solc.js";
import { debugTraceBlock } from "@/lib/trace/debug.js";
import { getContracts, getStorageLayout } from "@/lib/trace/storage-layout.js";
import { createClient } from "@/lib/trace/utils.js";
import { type StateChange, type WatchStateOptions } from "@/lib/watch/types.js";

/**
 * A naive and inefficient implementation of watching state changes.
 *
 * Note: your RPC will need to support `debug_traceBlock`, which we use to get the pre/post state diff.
 *
 * @param options - {@link WatchStateOptions}
 * @returns Promise<() => void> - Unsubscribe function
 */
export const watchState = async <TStorageLayout extends DeepReadonly<SolcStorageLayout> | undefined = undefined>(
  options: WatchStateOptions<TStorageLayout>,
): Promise<() => void> => {
  const { address, onStateChange, onError, pollingInterval = 1000 } = options;
  let { storageLayout, abi } = options;
  const client = options.client ?? createClient(options);

  if (!abi || !storageLayout) {
    const contractInfo = (
      await getContracts({
        client,
        addresses: [address],
        explorers: options.explorers,
      })
    )[address];

    if (!storageLayout)
      storageLayout = (await getStorageLayout({ ...contractInfo, address })) as TStorageLayout | undefined;
    if (!abi) abi = contractInfo?.abi;
  }

  const abiFunctions: Array<abi.ABIFunction> = abi
    ?.filter((func) => func.type === "function")
    .map((func) => {
      if (!("selector" in func)) return { ...func, selector: toFunctionSignature(func) } as abi.ABIFunction;
      return func;
    });

  const unsubscribe = client.watchBlocks({
    onError,
    pollingInterval,

    includeTransactions: true,
    onBlock: async (block) => {
      const traces = await debugTraceBlock(client, block.hash);
      traces.forEach(({ txHash, stateDiff, addresses, newAddresses, structLogs }) => {
        const uniqueAddresses = [...new Set([...addresses, ...newAddresses])].map((addr) => addr.toLowerCase());
        if (!uniqueAddresses.includes(address.toLowerCase())) return;

        // TODO: we might want to return the tx params (input) for each tx in debug_traceBlock to extract potential function args; this would avoid including transactions in the block which is solely for this
        const tx = block.transactions.find((tx) => tx.hash === txHash);
        const diff = labelStateDiff({
          stateDiff,
          layouts: storageLayout ? { [address.toLowerCase()]: storageLayout as SolcStorageLayout } : {},
          uniqueAddresses: uniqueAddresses as Array<Address>,
          structLogs,
          abiFunctions,
          // @ts-expect-error mismatch data
          options: {
            from: tx?.from,
            to: tx?.to ?? undefined,
            data: tx?.input,
            value: tx?.value,
          },
        })[address.toLowerCase() as Address];

        if (diff) onStateChange({ ...diff, txHash: txHash } as unknown as StateChange<TStorageLayout>);
      });
    },
  });

  return unsubscribe;
};
