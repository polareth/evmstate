import { type Abi, type Address, type Hex } from "tevm";
import { abi } from "@shazow/whatsabi";

import { type ExploreStorageConfig } from "@/lib/explore/config.js";
import type { DeepReadonly } from "@/lib/explore/types.js";
import { type SolcStorageLayout } from "@/lib/solc.js";
import type { LabeledStateDiff, TraceStateBaseOptions } from "@/lib/trace/types.js";

export type WatchStateOptions<
  TStorageLayout extends DeepReadonly<SolcStorageLayout> | SolcStorageLayout | undefined =
    | DeepReadonly<SolcStorageLayout>
    | SolcStorageLayout
    | undefined,
> = TraceStateBaseOptions & { config?: ExploreStorageConfig } & {
  address: Address;
  storageLayout?: TStorageLayout;
  abi?: Abi | abi.ABI;
  onStateChange: (state: StateChange<TStorageLayout>) => void;
  onError?: (error: Error) => void;
  pollingInterval?: number;
};

export type StateChange<
  TStorageLayout extends DeepReadonly<SolcStorageLayout> | SolcStorageLayout | undefined =
    | DeepReadonly<SolcStorageLayout>
    | SolcStorageLayout
    | undefined,
> = (TStorageLayout extends DeepReadonly<SolcStorageLayout>
  ? Partial<LabeledStateDiff<TStorageLayout>>
  : Partial<LabeledStateDiff>) & { txHash: Hex };
