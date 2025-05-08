import type { Address } from "tevm";
import type { ExtractAbiFunctions } from "abitype";
import { create } from "zustand";
import { persist } from "zustand/middleware";

import type { LabeledStateDiff } from "@polareth/evmstate";
import * as CONTRACTS from "@test/contracts/index.js";

import { stringify } from "~/utils.js";

const contract = CONTRACTS["Playground"];
const localStorageKey = "EVMSTATE_PLAYGROUND_TRACES";

export type Trace = {
  functionName: ExtractAbiFunctions<typeof contract.abi>["name"] | "deploy";
  args: any[];
  diff: Record<Address, LabeledStateDiff>;
};

interface PlaygroundState {
  traces: Array<Omit<Trace, "diff"> & { diff: string }>; // stringified diff
  addTrace: (trace: Trace) => void;
  clearTraces: () => void;
}

export const usePlaygroundStore = create<PlaygroundState>()(
  persist(
    (set) => ({
      traces: [] as Array<Omit<Trace, "diff"> & { diff: string }>,
      addTrace: (trace) => set((state) => ({ traces: [...state.traces, { ...trace, diff: stringify(trace.diff) }] })),
      clearTraces: () => set({ traces: [] }),
    }),
    {
      name: localStorageKey,
    },
  ),
);
