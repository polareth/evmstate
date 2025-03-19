import { Address, GetAccountResult, Hex, MemoryClient } from "tevm";
import { Common } from "tevm/common";
import { ForkOptions } from "tevm/state";

/* -------------------------------------------------------------------------- */
/*                                    TRACE                                   */
/* -------------------------------------------------------------------------- */

/**
 * Options for analyzing storage access patterns during transaction simulation.
 *
 * Note: You will need to provide either a memory client, fork options, or a JSON-RPC URL.
 *
 * @param from - Sender address
 * @param to - Target contract address (optional for contract creation)
 * @param data - Transaction calldata
 * @param client - Use existing memory client (either this or fork/rpcUrl is required)
 * @param fork - Fork configuration for creating a memory client
 * @param rpcUrl - JSON-RPC URL for creating a memory client
 * @param common - EVM chain configuration (improves performance by avoiding fetching chain info)
 */
export type TraceStorageAccessOptions = {
  /** Sender address */
  from: Address;
  /** Target contract address (optional for contract creation) */
  to?: Address;
  /** Transaction calldata */
  data: Hex;

  /** Use existing memory client (either this or fork/rpcUrl is required) */
  client?: MemoryClient;
  /** Fork configuration for creating a memory client */
  fork?: ForkOptions;
  /** JSON-RPC URL for creating a memory client */
  rpcUrl?: string;
  /** EVM chain configuration (improves performance by avoiding fetching chain info) */
  common?: Common;

  /** Explorers urls and keys to use for fetching contract sources and ABI */
  explorers?: {
    etherscan?: {
      baseUrl: string;
      apiKey?: string;
    };
    blockscout?: {
      baseUrl: string;
      apiKey?: string;
    };
  };
};

// TODO: change when we have something more specific (basically AccountDiff with optional labels)
export type StorageAccessTrace = AccountDiff;

/* -------------------------------------------------------------------------- */
/*                                 ACCESS LIST                                */
/* -------------------------------------------------------------------------- */

/**
 * Internal type representing the access list format from tevm.
 */
export type AccessList = Record<Address, Set<Hex>>;

/* --------------------------- STORAGE SLOT TYPES --------------------------- */
/**
 * Type representing the storage at a defined slot at a specific point in time.
 */
export type StorageSnapshot = {
  /** Storage slot location */
  [slot: Hex]: {
    /** Current storage value (may be undefined) */
    value: Hex | undefined;
  };
};

/**
 * Type representing a list of storage reads without modification.
 */
export type StorageReads = {
  /** Storage slot location */
  [slot: Hex]: {
    /** Current storage value */
    current: Hex;
  };
};

/**
 * Type representing a list of storage writes with modification.
 */
export type StorageWrites = {
  /** Storage slot location */
  [slot: Hex]: {
    /** Current storage value before transaction */
    current: Hex;
    /** New storage value after transaction */
    next: Hex;
  };
};

/* -------------------------- ACCOUNT STORAGE TYPES ------------------------- */
/**
 * State fields at the intrinsic level of an account.
 *
 * @internal
 */
type Intrinsics = Pick<GetAccountResult, "balance" | "codeHash" | "deployedBytecode" | "nonce" | "storageRoot">;

/**
 * Type representing the intrinsic state of an account at a specific point in time.
 */
export type IntrinsicsSnapshot = {
  /** Account field identifier */
  [K in keyof Intrinsics]: {
    /** Current value of the field */
    value: Intrinsics[K];
  };
};

/**
 * Type representing the difference in intrinsic account state during transaction.
 */
export type IntrinsicsDiff = {
  /** Account field identifier */
  [K in keyof Intrinsics]: {
    /** Value before transaction */
    current: Intrinsics[K];
    /** Value after transaction (undefined if not modified) */
    next?: Intrinsics[K];
  };
};

/* -------------------------- AGGREGATED STATE TYPES -------------------------- */
/**
 * Complete snapshot of an account's storage and account state at a point in time.
 *
 * This can represent either a contract or an EOA.
 */
export type AccountSnapshot<EOA extends boolean = false> = {
  /** Storage slots state (only applicable for contracts) */
  storage: EOA extends false ? StorageSnapshot : never;
  /** Account fields state */
  intrinsic: IntrinsicsSnapshot;
};

/**
 * Complete difference between pre-transaction and post-transaction states for an address.
 *
 * This can represent either a contract or an EOA (Externally Owned Account).
 */
export type AccountDiff<EOA extends boolean = false> = {
  /** Storage slots that were read but not modified during transaction (only applicable for contracts) */
  reads: EOA extends false ? StorageReads : never;
  /** Storage slots that were modified during transaction (only applicable for contracts) */
  writes: EOA extends false ? StorageWrites : never;
  /** Account field changes during transaction */
  intrinsic: IntrinsicsDiff;
};
