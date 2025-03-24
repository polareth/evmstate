import { Abi, Address, ContractFunctionName, GetAccountResult, Hex, MemoryClient } from "tevm";
import { Common } from "tevm/common";
import { abi } from "@shazow/whatsabi";
import { AbiStateMutability, ContractFunctionArgs, WriteContractParameters } from "viem";

import { AbiType, AbiTypeToPrimitiveType } from "@/lib/schema";

/* -------------------------------------------------------------------------- */
/*                                    TRACE                                   */
/* -------------------------------------------------------------------------- */

/**
 * Base options for analyzing storage access patterns during transaction simulation.
 *
 * Note: You will need to provide either a memory client or a JSON-RPC URL.
 *
 * @param client - Use existing memory client (either this or fork/rpcUrl is required)
 * @param rpcUrl - JSON-RPC URL for creating a memory client
 * @param common - EVM chain configuration (improves performance by avoiding fetching chain info)
 * @param explorers - Explorers urls and keys to use for fetching contract sources and ABI
 */
export type TraceStorageAccessOptions = {
  client?: MemoryClient;
  rpcUrl?: string;
  common?: Common;

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

/**
 * Transaction parameters for analyzing storage access patterns during transaction simulation.
 *
 * - Option 1: simulate a new transaction with the encoded calldata {@link TraceStorageAccessTxWithData}
 * - Option 2: simulate a new transaction with the ABI and function name/args {@link TraceStorageAccessTxWithAbi}
 * - Option 3: replay a transaction with its hash {@link TraceStorageAccessTxWithReplay}
 *
 * @example
 *   const simulateParams: TraceStorageAccessTxParams = {
 *     from: "0x123...",
 *     to: "0x456...", // optional
 *     data: "0x789...",
 *   };
 *
 * @example
 *   const simulateParams: TraceStorageAccessTxParams = {
 *   from: "0x123...",
 *   to: "0x456...", // optional
 *   abi: [...],
 *   functionName: "mint",
 *   args: [69420n],
 *   };
 *
 * @example
 *   const replayParams: TraceStorageAccessTxParams = {
 *     txHash: "0x123...",
 *   };
 */
export type TraceStorageAccessTxParams<
  TAbi extends Abi | readonly unknown[] = Abi,
  TFunctionName extends ContractFunctionName<TAbi> = ContractFunctionName<TAbi>,
> =
  | (Partial<
      Record<keyof TraceStorageAccessTxWithReplay | keyof Omit<TraceStorageAccessTxWithAbi, "from" | "to">, never>
    > &
      TraceStorageAccessTxWithData)
  | (Partial<
      Record<keyof TraceStorageAccessTxWithReplay | keyof Omit<TraceStorageAccessTxWithData, "from" | "to">, never>
    > &
      TraceStorageAccessTxWithAbi<TAbi, TFunctionName>)
  | (Partial<Record<keyof TraceStorageAccessTxWithData | keyof TraceStorageAccessTxWithAbi, never>> &
      TraceStorageAccessTxWithReplay);

/**
 * Transaction parameters with encoded calldata.
 *
 * @param from - Sender address
 * @param data - Transaction calldata
 * @param to - Target contract address (optional for contract creation)
 */
export type TraceStorageAccessTxWithData = { from: Address; data: Hex; to?: Address };

/**
 * Contract transaction parameters with ABI typed function name and arguments.
 *
 * @param from - Sender address
 * @param to - Target contract address
 * @param abi - Contract ABI
 * @param functionName - Function name
 * @param args - Function arguments
 */
export type TraceStorageAccessTxWithAbi<
  TAbi extends Abi | readonly unknown[] = Abi,
  TFunctionName extends ContractFunctionName<TAbi> = ContractFunctionName<TAbi>,
> = {
  from: Address;
  to: Address;
  abi: TAbi;
  functionName: TFunctionName;
  args: ContractFunctionArgs<TAbi, AbiStateMutability, TFunctionName>;
};

/**
 * Transaction parameters from replaying a transaction with its hash.
 *
 * @param txHash - Transaction hash
 */
export type TraceStorageAccessTxWithReplay = { txHash: Hex };

/**
 * Storage access trace for a transaction
 *
 * @template EOA - Whether the account is an EOA (Externally Owned Account)
 * @param reads - Storage slots that were read but not modified during transaction (only applicable for contracts)
 * @param writes - Storage slots that were modified during transaction (only applicable for contracts)
 * @param intrinsic - Account field changes during transaction
 */
export type StorageAccessTrace<EOA extends boolean = false> = {
  reads: EOA extends false ? { [slot: Hex]: [LabeledStorageRead, ...LabeledStorageRead[]] } : never;
  writes: EOA extends false ? { [slot: Hex]: [LabeledStorageWrite, ...LabeledStorageWrite[]] } : never;
  intrinsic: IntrinsicsDiff;
};

/**
 * Labeled storage read with decoded value and type
 *
 * @param current - The current storage value in hex and decoded form (if available)
 * @param type - The ABI type of the storage value
 * @param label - The label retrieved from the storage layout
 * @param keys - Any mapping keys if the value is mapped
 * @param index - The index of the entry if it's inside an array
 * @param offset - The offset of this variable within the slot (for packed variables)
 */
export type LabeledStorageRead<T extends AbiType = AbiType> = {
  label?: string;
  type?: T;
  current: {
    hex: Hex;
    decoded?: AbiTypeToPrimitiveType<T>;
  };
  keys?: Array<MappingKey>;
  index?: bigint;
  offset?: number; // Offset in bytes for packed variables
};

/**
 * Labeled storage write with decoded value and type
 *
 * @param next - The new storage value in hex and decoded form (if available)
 * @see {@link LabeledStorageRead} for other properties
 */
export type LabeledStorageWrite<T extends AbiType = AbiType> = LabeledStorageRead<T> & {
  next: {
    hex: Hex;
    decoded?: AbiTypeToPrimitiveType<T>;
  };
};

/* -------------------------------------------------------------------------- */
/*                                 ACCESS LIST                                */
/* -------------------------------------------------------------------------- */

/** Internal type representing the access list format from tevm. */
export type AccessList = Record<Address, Set<Hex>>;

/* --------------------------- STORAGE SLOT TYPES --------------------------- */
/** Type representing the storage at a defined slot at a specific point in time. */
export type StorageSnapshot = {
  /** Storage slot location */
  [slot: Hex]: {
    /** Current storage value (may be undefined) */
    value: Hex | undefined;
  };
};

/** Type representing a list of storage reads without modification. */
export type StorageReads = {
  /** Storage slot location */
  [slot: Hex]: {
    /** Current storage value */
    current: Hex;
  };
};

/** Type representing a list of storage writes with modification. */
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

/** Type representing the intrinsic state of an account at a specific point in time. */
export type IntrinsicsSnapshot = {
  /** Account field identifier */
  [K in keyof Intrinsics]: {
    /** Current value of the field */
    value: Intrinsics[K];
  };
};

/** Type representing the difference in intrinsic account state during transaction. */
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

/* -------------------------------------------------------------------------- */
/*                                 STORAGE LAYOUT                             */
/* -------------------------------------------------------------------------- */

/* ---------------------------------- SLOTS --------------------------------- */
/** Type for representing labeled storage slots */
// TODO: review
export type StorageSlotInfo<T extends StorageLayoutType["encoding"] = StorageLayoutType["encoding"]> = {
  slot: Hex;
  label: string;
  path: string;
  type: AbiType;
  encoding: T;
  isComputed: boolean;
  keyType?: T extends "mapping" ? AbiType : never;
  valueType?: T extends "mapping" ? AbiType : never;
  baseType?: T extends "dynamic_array" ? AbiType : never;
  offset?: number;
};

export interface MappingKey<T extends AbiType = AbiType> {
  // Value padded to 32 bytes
  hex: Hex;
  // Type of the value if known
  type?: T;
  // Decoded value if known
  decoded?: AbiTypeToPrimitiveType<T>;
}

export type SlotMatchType = "exact" | "mapping" | "nested-mapping" | "array" | "struct";

export interface SlotLabelResult<M extends SlotMatchType = SlotMatchType> {
  // The variable name with formatted keys
  label: string;
  // The slot being accessed
  slot: string;
  // The type of match that was found
  matchType: M;
  // The variable type (from Solidity)
  type?: AbiType;
  // The detected keys or indices (if applicable)
  keys?: M extends "mapping" | "nested-mapping" ? Array<MappingKey> : never;
  // The detected index (if applicable)
  index?: M extends "array" ? Hex : never;
  // The offset of the variable within the slot (for packed variables)
  offset?: number;
}

/* -------------------------------- WHATSABI -------------------------------- */
export type GetContractsOptions = {
  client: MemoryClient;
  addresses: Array<Address>;
  explorers?: TraceStorageAccessOptions["explorers"];
};

export type GetContractsResult = Record<
  Address,
  {
    metadata: {
      name?: string;
      evmVersion?: string;
      compilerVersion?: string;
    };
    sources?: Array<{ path?: string; content: string }>;
    abi: abi.ABI;
  }
>;

/* ------------------------------- TODO: TEMP ------------------------------- */
// WARNING: the following types are experimental (?) and subject to change in non breaking releases
// Define the base structure for all storage layout types
export interface StorageLayoutTypeBase {
  encoding: "inplace" | "mapping" | "dynamic_array" | "bytes";
  label: AbiType;
  numberOfBytes: string;
}

// Define specific storage layout types with their unique properties
export interface StorageLayoutInplaceType extends StorageLayoutTypeBase {
  encoding: "inplace";
}

export interface StorageLayoutBytesType extends StorageLayoutTypeBase {
  encoding: "bytes";
}

export interface StorageLayoutMappingType extends StorageLayoutTypeBase {
  encoding: "mapping";
  key: `t_${string}`;
  value: `t_${string}`;
}

export interface StorageLayoutDynamicArrayType extends StorageLayoutTypeBase {
  encoding: "dynamic_array";
  base: `t_${string}`;
}

export interface StorageLayoutStructType extends StorageLayoutInplaceType {
  members: Array<StorageLayoutItem>;
}

// Union of all possible storage layout types
export type StorageLayoutType =
  | StorageLayoutInplaceType
  | StorageLayoutBytesType
  | StorageLayoutMappingType
  | StorageLayoutDynamicArrayType
  | StorageLayoutStructType;

// Type-safe record of storage layout types
export type StorageLayoutTypes = Record<`t_${string}`, StorageLayoutType>;

// Type-safe storage layout item that references a type in StorageLayoutTypes
export type StorageLayoutItem<T extends StorageLayoutTypes = StorageLayoutTypes> = {
  astId: number;
  contract: string;
  label: string;
  offset: number;
  slot: string;
  type: keyof T;
};

// Type-safe storage layout output
export type StorageLayoutOutput<T extends StorageLayoutTypes = StorageLayoutTypes> = {
  storage: Array<StorageLayoutItem<T>>;
  types: T;
};
