import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { type Abi, type TraceResult } from "tevm";
import { type Address, type ContractFunctionName, type Hex } from "tevm/utils";
import { abi } from "@shazow/whatsabi";

import { parse, stringify } from "@/lib/explore/json.js";
import { type SolcStorageLayout } from "@/lib/solc.js";
import { TraceStateResult } from "@/lib/trace/result.js";
import type { LabeledIntrinsicsState, LabeledState, TraceStateOptions } from "@/lib/trace/types.js";
import { logger } from "@/logger.js";
import { labelStateDiff as _labelStateDiff } from "@/zig/explore/label-state-diff.js";
import { initWasm } from "@/zig/wasm-loader.js";

type LabelStateDiffArgs<TAbi extends Abi | readonly unknown[], TFunctionName extends ContractFunctionName<TAbi>> = {
  stateDiff: Record<
    Address,
    LabeledIntrinsicsState & { storage: Record<Hex, { current?: Hex; next?: Hex; modified: boolean }> }
  >;
  layouts: Record<Address, SolcStorageLayout>;
  uniqueAddresses: Array<Address>;
  structLogs: TraceResult["structLogs"];
  abiFunctions: Array<abi.ABIFunction>;
  options: TraceStateOptions<TAbi, TFunctionName>;
};

export const labelStateDiff = async <
  TAbi extends Abi | readonly unknown[] = Abi,
  TFunctionName extends ContractFunctionName<TAbi> = ContractFunctionName<TAbi>,
>(
  args: LabelStateDiffArgs<TAbi, TFunctionName>,
): Promise<TraceStateResult> => {
  // Initialize WASM instance with all implementation methods
  const wasmModule = await initWasm();
  console.log(wasmModule.exports.add(1, 2));

  return _labelStateDiff(args);
};
