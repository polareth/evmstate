import type { Address } from "tevm";
import type { ExtractAbiFunctions } from "abitype";
import { create } from "zustand";
import { persist } from "zustand/middleware";

import type { LabeledState } from "@polareth/evmstate";
import * as CONTRACTS from "@test/contracts/index.js";

import { stringify } from "~/utils.js";

const contract = CONTRACTS["Playground"];
const localStorageKey = "EVMSTATE_PLAYGROUND_TRACES";

export type Trace = {
  functionName: ExtractAbiFunctions<typeof contract.abi>["name"] | "deploy";
  args: any[];
  state: Record<Address, LabeledState>;
};

interface PlaygroundState {
  traces: Array<Omit<Trace, "state"> & { state: string }>; // stringified state
  addTrace: (trace: Trace) => void;
  clearTraces: () => void;
}

export const usePlaygroundStore = create<PlaygroundState>()(
  persist(
    (set) => ({
      traces: [] as Array<Omit<Trace, "state"> & { state: string }>,
      addTrace: (trace) => set((state) => ({ traces: [...state.traces, { ...trace, state: stringify(trace.state) }] })),
      clearTraces: () => set({ traces: [] }),
    }),
    {
      name: localStorageKey,
    },
  ),
);
