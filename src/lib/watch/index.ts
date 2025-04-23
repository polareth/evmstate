import { CallResult, createMemoryClient, createTevmNode, http } from "tevm";
import { SolcStorageLayout, SolcStorageLayoutTypes } from "tevm/bundler/solc";
import { abi } from "@shazow/whatsabi";
import { toFunctionSignature, trim } from "viem";

import { debug } from "@/debug";
import { exploreStorage } from "@/lib/explore";
import { parseConfig } from "@/lib/explore/config";
import { extractPotentialKeys } from "@/lib/explore/mapping";
import { DeepReadonly } from "@/lib/explore/types";
import { intrinsicDiff, intrinsicSnapshot, storageDiff, storageSnapshot } from "@/lib/trace/access-list";
import { getContracts, getStorageLayout } from "@/lib/trace/storage-layout";
import { LabeledStorageAccess } from "@/lib/trace/types";
import { cleanTrace, createClient } from "@/lib/trace/utils";
import { StateChange, WatchStateOptions } from "@/lib/watch/types";

// A naive and inefficient implementation of watching state changes.
export const watchState = async <TStorageLayout extends DeepReadonly<SolcStorageLayout> | undefined = undefined>(
  options: WatchStateOptions<TStorageLayout>,
): Promise<() => void> => {
  const { client: _client, rpcUrl, common, address, onStateChange, onError, pollingInterval = 1000 } = options;
  let { storageLayout, abi } = options;

  // This client frequently rebases and watches incoming blocks
  const followClient = _client ?? createClient({ rpcUrl, common });
  const { state } = await followClient.tevmDumpState();
  // This client reproduces transactions in memory to trace pre/post state
  const memoryClient = createMemoryClient(followClient);
  await memoryClient.tevmLoadState({ state });

  if (!abi || !storageLayout) {
    const contractInfo = (
      await getContracts({
        client: followClient,
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

  const unsubscribe = followClient.watchBlocks({
    onError,
    pollingInterval,
    includeTransactions: true,
    onBlock: async (block) => {
      // TODO: add to some queue
      await Promise.all(
        block.transactions.map(async (tx) => {
          // Execute call on local vm with access list generation and trace
          let callResult: CallResult | undefined;
          try {
            callResult = await memoryClient.tevmCall({
              from: tx.from,
              to: tx.to ?? undefined,
              data: tx.input,
              value: tx.value,
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

          const addresses = Object.values(callResult.preimages ?? {}).filter(
            (address) => address !== "0x0000000000000000000000000000000000000000",
          );

          if (!addresses.includes(address)) return;
          debug(`${addresses.length} accounts touched during the transaction, including ${address}`);

          // Extract potential key/index values from the execution trace
          const traceLog = callResult.trace?.structLogs || [];
          // Create a slim version of the trace with deduplicated stack values for efficiency
          const dedupedTraceLog = {
            // Deduplicate stack values across all operations
            uniqueStackValues: [...new Set(traceLog.flatMap((log) => log.stack))],
            // Only keep storage-related operations for detailed analysis
            relevantOps: traceLog.filter((log) => ["SLOAD", "SSTORE", "SHA3"].includes(log.op)),
          };

          const potentialKeys = extractPotentialKeys(dedupedTraceLog, addresses, abiFunctions);
          debug(`Extracted ${potentialKeys.length} unique potential values from the trace`);

          // Get the storage and account values before the transaction is mined
          const storagePreTx = await storageSnapshot(memoryClient, {
            [address]: callResult.accessList?.[address] ?? new Set(),
          });
          const intrinsicsPreTx = await intrinsicSnapshot(memoryClient, [address]);

          // Mine the pending transaction to get post-state values
          await memoryClient.tevmMine();

          // Get values after the transaction has been included
          const storagePostTx = await storageSnapshot(memoryClient, {
            [address]: callResult.accessList?.[address] ?? new Set(),
          });
          const intrinsicsPostTx = await intrinsicSnapshot(memoryClient, [address]);

          // Create enhanced trace with labels
          const storage = { pre: storagePreTx[address], post: storagePostTx[address] };
          const intrinsics = { pre: intrinsicsPreTx[address], post: intrinsicsPostTx[address] };

          // For EOAs (accounts without code) we won't have storage data
          const storageTrace = storage.pre && storage.post ? storageDiff(storage.pre, storage.post) : {};
          // Skip if this address has no relevant data
          if (
            !Object.keys(intrinsics.pre).length &&
            !Object.keys(intrinsics.post).length &&
            !Object.keys(storageTrace).length
          ) {
            debug(`Missing account state information for address ${address}`);
            return;
          }

          if (!storageLayout) {
            onStateChange({
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
              txHash: tx.hash,
            } as unknown as StateChange<TStorageLayout>);

            return;
          }

          // 1. Decode using all known variables with optimized exploration
          const { withLabels, unexploredSlots } = exploreStorage(
            storageLayout as SolcStorageLayout,
            storageTrace,
            potentialKeys.map((k) => k.hex),
            parseConfig(options.config),
          );

          // 2. Process results into named variables - convert all results to LabeledStorageAccess format
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

          // 3. Create unknown variables access traces for remaining slots
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
          ) as Record<string, LabeledStorageAccess<string, string, SolcStorageLayoutTypes>>;

          // Return enhanced trace with labels
          onStateChange({
            storage: { ...decoded, ...unknownAccess },
            intrinsic: intrinsicDiff(intrinsics.pre, intrinsics.post),
            txHash: tx.hash,
          } as unknown as StateChange<TStorageLayout>);
        }),
      );
    },
  });

  return unsubscribe;
};
