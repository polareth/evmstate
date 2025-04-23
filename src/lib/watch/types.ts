import { Abi, Address, Hex } from "tevm";
import { SolcStorageLayout } from "tevm/bundler/solc";
import { abi } from "@shazow/whatsabi";

import { ExploreStorageConfig } from "@/lib/explore/config";
import { DeepReadonly } from "@/lib/explore/types";
import { StorageAccessTrace, TraceStorageAccessOptions } from "@/lib/trace/types";

export type WatchStateOptions<TStorageLayout extends DeepReadonly<SolcStorageLayout> | undefined = undefined> =
  TraceStorageAccessOptions & { config?: ExploreStorageConfig } & {
    address: Address;
    storageLayout?: TStorageLayout;
    abi?: Abi | abi.ABI;
    onStateChange: (state: StateChange<TStorageLayout>) => void;
    onError?: (error: Error) => void;
    pollingInterval?: number;
  };

export type StateChange<TStorageLayout extends DeepReadonly<SolcStorageLayout> | undefined = undefined> =
  (TStorageLayout extends DeepReadonly<SolcStorageLayout>
    ? Partial<StorageAccessTrace<TStorageLayout>>
    : Partial<StorageAccessTrace>) & { txHash: Hex };
