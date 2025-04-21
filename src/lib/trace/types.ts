import { Abi, Address, ContractFunctionName, GetAccountResult, Hex, MemoryClient } from "tevm";
import { SolcStorageLayout, SolcStorageLayoutTypes } from "tevm/bundler/solc";
import { Common } from "tevm/common";
import { abi } from "@shazow/whatsabi";
import { AbiStateMutability, ContractFunctionArgs } from "viem";

import {
  DeepReadonly,
  ParseSolidityType,
  PathSegment,
  SolidityTypeToTsType,
  VariableExpression,
  VariablePathSegments,
} from "@/lib/explore/types";

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
      Record<
        keyof TraceStorageAccessTxWithReplay | keyof Omit<TraceStorageAccessTxWithAbi, "from" | "to" | "value">,
        never
      >
    > &
      TraceStorageAccessTxWithData)
  | (Partial<
      Record<
        keyof TraceStorageAccessTxWithReplay | keyof Omit<TraceStorageAccessTxWithData, "from" | "to" | "value">,
        never
      >
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
export type TraceStorageAccessTxWithData = { from: Address; data?: Hex; to?: Address; value?: bigint };

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
  value?: bigint;
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
 * @param storage - Storage slots that were accessed during transaction (only applicable for contracts)
 * @param intrinsic - Account field changes during transaction
 */
export type StorageAccessTrace<T extends DeepReadonly<SolcStorageLayout> = SolcStorageLayout> = {
  storage: {
    [Variable in T["storage"][number] as Variable["label"]]: LabeledStorageAccess<
      Variable["label"],
      ParseSolidityType<Variable["type"], T["types"]>,
      T["types"]
    >;
  };
  intrinsic: IntrinsicsDiff;
};

export type LabeledStorageAccess<
  TName extends string = string,
  T extends string | undefined = string | undefined,
  Types extends SolcStorageLayoutTypes = SolcStorageLayoutTypes,
> = {
  /** The name of the variable in the layout */
  name: TName;
  /** The entire Solidity definition of the variable (e.g. "mapping(uint256 => mapping(address => bool))" or "uint256[]") */
  type?: T; // TODO: rename to definition (also everywhere we call it "T", e.g. TDef & definition/typeDef)
  /** The more global kind of variable for easier parsing of the trace (e.g. "mapping", "array", "struct", "primitive") */
  kind?: T extends `mapping(${string} => ${string})`
    ? "mapping"
    : T extends `${string}[]`
      ? "dynamic_array"
      : T extends `${string}[${string}]`
        ? "static_array"
        : T extends `struct ${string}`
          ? "struct"
          : T extends "bytes" | "string"
            ? "bytes"
            : T extends `${string}`
              ? "primitive"
              : T extends undefined
                ? undefined
                : never;
  /** The trace of the variable's access */
  trace: Array<LabeledStorageAccessTrace<TName, T, Types>>;
};

export type LabeledStorageAccessTrace<
  TName extends string = string,
  T extends string | undefined = string | undefined,
  Types extends SolcStorageLayoutTypes = SolcStorageLayoutTypes,
> = {
  /** The decoded value of the variable */
  current: {
    decoded?: T extends string ? SolidityTypeToTsType<T, Types> : unknown;
    hex: Hex;
  };
  /** The slots storing some of the variable's data that were accessed */
  slots: Array<Hex>;
  /** The path to the variable */
  path: T extends string ? VariablePathSegments<T, Types> : Array<PathSegment>;
  /** The full expression of the variable */
  fullExpression: T extends string ? VariableExpression<TName, T, Types> : string;
  /** Any note during decoding */
  note?: string;
} & (
  | {
      modified: true;
      /** The next value after the transaction (if it was modified) */
      next: {
        decoded?: T extends string ? SolidityTypeToTsType<T, Types> : unknown;
        hex: Hex;
      };
    }
  | {
      modified: false;
      next?: never;
    }
);

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

/** Type representing a list of storage writes with modification. */
export type StorageDiff = {
  /** Storage slot location */
  [slot: Hex]: {
    /** Current storage value */
    current: Hex;
    /** New storage value after transaction */
    next?: Hex;
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

/* -------------------------------------------------------------------------- */
/*                                 STORAGE LAYOUT                             */
/* -------------------------------------------------------------------------- */

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
    isProxy: boolean;
  }
>;
