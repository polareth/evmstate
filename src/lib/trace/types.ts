import { type Abi, type Address, type ContractFunctionName, type Hex, type MemoryClient } from "tevm";
import { type Common } from "tevm/common";
import { abi } from "@shazow/whatsabi";
import { type AbiStateMutability, type ContractFunctionArgs } from "viem";

import type {
  DeepReadonly,
  ParseSolidityType,
  PathSegment,
  SolidityTypeToTsType,
  VariableExpression,
  VariablePathSegments,
} from "@/lib/explore/types.js";
import { type ExploreStorageConfig } from "@/lib/explore/types.js";
import { type SolcStorageLayout, type SolcStorageLayoutTypes } from "@/lib/solc.js";

/* -------------------------------------------------------------------------- */
/*                                    TRACE                                   */
/* -------------------------------------------------------------------------- */

/* --------------------------------- OPTIONS -------------------------------- */
/** Aggregated options for analyzing storage access patterns during transaction simulation. */
export type TraceStateOptions<
  TAbi extends Abi | readonly unknown[] = Abi,
  TFunctionName extends ContractFunctionName<TAbi> = ContractFunctionName<TAbi>,
> = TraceStateBaseOptions & TraceStateTxParams<TAbi, TFunctionName> & { config?: ExploreStorageConfig };

/**
 * Base options for analyzing storage access patterns during transaction simulation.
 *
 * Note: You will need to provide either a memory client or a JSON-RPC URL.
 */
export type TraceStateBaseOptions = {
  /** An existing memory client to use for tracing (either this or fork/rpcUrl is required) */
  client?: MemoryClient;
  /** JSON-RPC URL for creating a memory client */
  rpcUrl?: string;
  /** EVM chain configuration (improves performance by avoiding fetching chain info) */
  common?: Common;

  /** Optional storage layouts to help labeling the trace */
  storageLayouts?: Record<Address, SolcStorageLayout | DeepReadonly<SolcStorageLayout>>;
  /** Whether to try to fetch storage layouts for touched accounts (default: true) */
  fetchStorageLayouts?: boolean;
  /**
   * Whether to try to fetch contract infos for touched accounts (default: true)
   *
   * Note: This is used for retrieving ABIs and storage layouts, so setting this to false will be effective only if
   * `fetchStorageLayouts` is also set to false.
   */
  fetchContracts?: boolean;

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

/**
 * Transaction parameters for analyzing storage access patterns during transaction simulation.
 *
 * - Option 1: simulate a new transaction with the encoded calldata {@link TraceStateTxWithData}
 * - Option 2: simulate a new transaction with the ABI and function name/args {@link TraceStateTxWithAbi}
 * - Option 3: replay a transaction with its hash {@link TraceStateTxWithReplay}
 *
 * @example
 *   const simulateParams: TraceStateTxParams = {
 *     from: "0x123...",
 *     to: "0x456...", // optional
 *     data: "0x789...",
 *   };
 *
 * @example
 *   const simulateParams: TraceStateTxParams = {
 *   from: "0x123...",
 *   to: "0x456...", // optional
 *   abi: [...],
 *   functionName: "mint",
 *   args: [69420n],
 *   };
 *
 * @example
 *   const replayParams: TraceStateTxParams = {
 *     txHash: "0x123...",
 *   };
 */
export type TraceStateTxParams<
  TAbi extends Abi | readonly unknown[] = Abi,
  TFunctionName extends ContractFunctionName<TAbi> = ContractFunctionName<TAbi>,
> =
  | (Partial<Record<keyof TraceStateTxWithReplay | keyof Omit<TraceStateTxWithAbi, "from" | "to" | "value">, never>> &
      TraceStateTxWithData)
  | (Partial<Record<keyof TraceStateTxWithReplay | keyof Omit<TraceStateTxWithData, "from" | "to" | "value">, never>> &
      TraceStateTxWithAbi<TAbi, TFunctionName>)
  | (Partial<Record<keyof TraceStateTxWithData | keyof TraceStateTxWithAbi, never>> & TraceStateTxWithReplay);

/**
 * Transaction parameters with encoded calldata.
 *
 * @param from - Sender address
 * @param data - Transaction calldata
 * @param to - Target contract address (optional for contract creation)
 */
export type TraceStateTxWithData = { from: Address; data?: Hex; to?: Address; value?: bigint };

/**
 * Contract transaction parameters with ABI typed function name and arguments.
 *
 * @param from - Sender address
 * @param to - Target contract address
 * @param abi - Contract ABI
 * @param functionName - Function name
 * @param args - Function arguments
 */
export type TraceStateTxWithAbi<
  TAbi extends Abi | readonly unknown[] = Abi,
  TFunctionName extends ContractFunctionName<TAbi> = ContractFunctionName<TAbi>,
> = {
  from: Address;
  to: Address;
  abi: TAbi;
  functionName: TFunctionName;
  args?: ContractFunctionArgs<TAbi, AbiStateMutability, TFunctionName>;
  value?: bigint;
};

/**
 * Transaction parameters from replaying a transaction with its hash.
 *
 * @param txHash - Transaction hash
 */
export type TraceStateTxWithReplay = { txHash: Hex };

/* ---------------------------------- TRACE --------------------------------- */
/**
 * Account state access trace for a transaction
 *
 * @param storage - Storage slots that were accessed during transaction (only applicable for contracts) with a labeled
 *   state capture
 * @param ... {@link AccountIntrinsicState} fields that were accessed during transaction (e.g. balance, nonce, code,
 *   etc.) with a labeled state capture
 */
export type LabeledState<
  TStorageLayout extends DeepReadonly<SolcStorageLayout> | SolcStorageLayout = SolcStorageLayout,
> = LabeledIntrinsicsState & {
  storage: {
    [Variable in TStorageLayout["storage"][number] as Variable["label"]]: LabeledStorageState<
      Variable["label"],
      ParseSolidityType<Variable["type"], TStorageLayout["types"]>,
      TStorageLayout["types"]
    >;
  };
};

export type AccountIntrinsicState = { balance: bigint; nonce: number; code: Hex };
export type LabeledIntrinsicsState = {
  [K in keyof AccountIntrinsicState]:
    | {
        modified: true;
        /** The value before the transaction */
        current?: AccountIntrinsicState[K];
        /** The next value after the transaction (if it was modified) */
        next?: AccountIntrinsicState[K];
      }
    | {
        modified: false;
        next?: never;
        /** The value before the transaction */
        current?: AccountIntrinsicState[K];
      };
};

export type LabeledStorageState<
  TName extends string = string,
  TTypeId extends string | undefined = string | undefined,
  TTypes extends SolcStorageLayoutTypes = SolcStorageLayoutTypes,
> = {
  /** The name of the variable in the layout */
  name: TName;
  /** The entire Solidity definition of the variable (e.g. "mapping(uint256 => mapping(address => bool))" or "uint256[]") */
  type?: TTypeId;
  /** The more global kind of variable for easier parsing of the trace (e.g. "mapping", "array", "struct", "primitive") */
  kind?: TTypeId extends `mapping(${string} => ${string})`
    ? "mapping"
    : TTypeId extends `${string}[]`
      ? "dynamic_array"
      : TTypeId extends `${string}[${string}]`
        ? "static_array"
        : TTypeId extends `struct ${string}`
          ? "struct"
          : TTypeId extends "bytes" | "string"
            ? "bytes"
            : TTypeId extends `${string}`
              ? "primitive"
              : TTypeId extends undefined
                ? undefined
                : never;
  /** The trace of the variable's access */
  trace: Array<LabeledStorageStateTrace<TName, TTypeId, TTypes>>;
};

/**
 * The trace of a variable's access
 *
 * `current` and `next` can always be undefined regardless of the `modified` flag, as it might be a new contract, or a
 * selfdestruct if the hardfork supports it.
 */
export type LabeledStorageStateTrace<
  TName extends string = string,
  TTypeId extends string | undefined = string | undefined,
  TTypes extends SolcStorageLayoutTypes = SolcStorageLayoutTypes,
> = {
  /** The slots storing some of the variable's data that were accessed */
  slots: Array<Hex>;
  /** The path to the variable */
  path: TTypeId extends string ? VariablePathSegments<TTypeId, TTypes> : Array<PathSegment>;
  /** The full expression of the variable */
  fullExpression: TTypeId extends string ? VariableExpression<TName, TTypeId, TTypes> : string;
  /** Any note during decoding */
  note?: string;
} & (
  | {
      modified: true;
      /** The value before the transaction */
      current?: {
        decoded?: TTypeId extends string ? SolidityTypeToTsType<TTypeId, TTypes> : unknown;
        hex: Hex;
      };
      /** The next value after the transaction (if it was modified) */
      next?: {
        decoded?: TTypeId extends string ? SolidityTypeToTsType<TTypeId, TTypes> : unknown;
        hex: Hex;
      };
    }
  | {
      modified: false;
      next?: never;
      /** The value before the transaction */
      current?: {
        decoded?: TTypeId extends string ? SolidityTypeToTsType<TTypeId, TTypes> : unknown;
        hex: Hex;
      };
    }
);

/* -------------------------------------------------------------------------- */
/*                                 STORAGE LAYOUT                             */
/* -------------------------------------------------------------------------- */

/* -------------------------------- WHATSABI -------------------------------- */
export type GetContractsOptions = {
  client: MemoryClient;
  addresses: Array<Address>;
  explorers?: TraceStateBaseOptions["explorers"];
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
