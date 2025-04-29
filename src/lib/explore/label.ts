import { Abi } from "tevm";
import { EvmTraceResult } from "tevm/actions";
import { SolcStorageLayout, SolcStorageLayoutTypes } from "tevm/bundler/solc";
import { Address, ContractFunctionName, Hex } from "tevm/utils";
import { abi } from "@shazow/whatsabi";
import { trim } from "viem";

import { debug } from "@/debug";
import { exploreStorage } from "@/lib/explore";
import { parseConfig } from "@/lib/explore/config";
import { extractPotentialKeys } from "@/lib/explore/mapping";
import { LabeledIntrinsicsDiff, LabeledStateDiff, LabeledStorageDiff, TraceStateOptions } from "@/lib/trace/types";
import { cleanTrace } from "@/lib/trace/utils";

export const labelStateDiff = <
  TAbi extends Abi | readonly unknown[] = Abi,
  TFunctionName extends ContractFunctionName<TAbi> = ContractFunctionName<TAbi>,
>({
  stateDiff,
  layouts,
  uniqueAddresses,
  structLogs,
  abiFunctions,
  options,
}: {
  stateDiff: Record<
    Address,
    LabeledIntrinsicsDiff & { storage: Record<Hex, { current?: Hex; next?: Hex; modified: boolean }> }
  >;
  layouts: Record<Address, SolcStorageLayout>;
  uniqueAddresses: Array<Address>;
  structLogs: EvmTraceResult["structLogs"];
  abiFunctions: Array<abi.ABIFunction>;
  options: TraceStateOptions<TAbi, TFunctionName>;
}): Record<Address, LabeledStateDiff> => {
  // Extract potential key/index values from the execution trace
  // Create a slim version of the trace with deduplicated stack values for efficiency
  const dedupedTraceLog = {
    // Deduplicate stack values across all operations
    uniqueStackValues: [...new Set(structLogs.flatMap((log) => log.stack))],
    // Only keep storage-related operations for detailed analysis
    relevantOps: structLogs.filter((log) => ["SLOAD", "SSTORE", "SHA3"].includes(log.op)),
  };

  const potentialKeys = extractPotentialKeys(dedupedTraceLog, uniqueAddresses, abiFunctions, options);
  debug(`Extracted ${potentialKeys.length} unique potential values from the trace`);

  // Process each address and create enhanced trace with labels
  return uniqueAddresses.reduce(
    (acc, address) => {
      const layout = layouts[address];
      const { storage, ...intrinsics } = stateDiff[address];

      if (!layout) {
        acc[address] = {
          ...intrinsics,
          storage: Object.entries(storage).reduce(
            (acc, [slot, { current, next }]) => {
              acc[`slot_${slot}`] = {
                name: `slot_${slot}`,
                trace: [
                  // @ts-expect-error - Type boolean is not assignable to false
                  {
                    modified: next !== undefined && current !== undefined && next !== current,
                    ...(current !== undefined ? { current: { hex: current } } : {}),
                    ...(next !== undefined ? { next: { hex: next } } : {}),
                    slots: [slot as Hex],
                    path: [],
                    fullExpression: `slot_${slot}`,
                    note: "Could not label this slot access because no layout was found.",
                  },
                ],
              };
              return acc;
            },
            {} as Record<string, LabeledStorageDiff<string, string, SolcStorageLayoutTypes>>,
          ),
        };

        return acc;
      }

      // 1. Decode using all known variables with optimized exploration
      const { withLabels, unexploredSlots } = exploreStorage(
        layout,
        storage,
        potentialKeys.map((k) => k.hex),
        parseConfig(options.config),
      );

      // 2. Process results into named variables - convert all results to LabeledStorageDiff format
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
              modified:
                result.next !== undefined &&
                result.current !== undefined &&
                trim(result.next.hex) !== trim(result.current.hex),
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
        {} as Record<string, LabeledStorageDiff<string, string, SolcStorageLayoutTypes>>,
      );

      // 3. Create unknown variables access traces for remaining slots
      const unknownAccess = Object.fromEntries(
        [...unexploredSlots].map((slot) => {
          const current = storage[slot].current;
          const next = storage[slot].next;

          return [
            `slot_${slot}`,
            {
              name: `slot_${slot}`,
              trace: [
                cleanTrace({
                  modified: next !== undefined && current !== undefined && next !== current,
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
        ...intrinsics,
        storage: { ...decoded, ...unknownAccess },
      };

      return acc;
    },
    {} as Record<Address, LabeledStateDiff>,
  );
};
