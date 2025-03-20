/// All of the below typing to retrieve TypeScript types from Solidity types is borrowed from MUD.
/// We use this both to infer types for type-safety and to decode Hex values into accurate JavaScript types.
/// see: https://github.com/latticexyz/mud/blob/main/packages/recs/src/types.ts
/// see: https://github.com/latticexyz/mud/blob/main/packages/schema-type/src/typescript/schemaAbiTypes.ts

import { Hex } from "tevm";

// TODO: figure out if we can retrieve arrays in this context?
// TODO: is it useful? is it worth bloating the library with this?

/**
 * Used to specify the types for properties, and infer their TypeScript type.
 */
enum AdapterType {
  Boolean,
  Number,
  NumberArray,
  BigInt,
  BigIntArray,
  String,
  StringArray,
  Hex,
  HexArray,
  T,
}

/**
 * Defines the Typescript types of values that can be decoded from a Hex value.
 */
type PrimitiveType =
  | boolean
  | number
  | number[]
  | bigint
  | bigint[]
  | string
  | string[]
  | Hex
  | Hex[]
  | unknown
  | undefined;

/**
 * Defines a mapping between JavaScript {@link Type} enums and their corresponding TypeScript types.
 *
 * @category Schema
 */
type MappedType<T = unknown> = {
  [AdapterType.Boolean]: boolean;
  [AdapterType.Number]: number;
  [AdapterType.NumberArray]: number[];
  [AdapterType.BigInt]: bigint;
  [AdapterType.BigIntArray]: bigint[];
  [AdapterType.String]: string;
  [AdapterType.StringArray]: string[];
  [AdapterType.Hex]: Hex;
  [AdapterType.HexArray]: Hex[];
  [AdapterType.T]: T;
};

/**
 * Defines the Solidity types for later conversion to TypeScript types.
 */
const abiTypes = [
  "uint8",
  "uint16",
  "uint24",
  "uint32",
  "uint40",
  "uint48",
  "uint56",
  "uint64",
  "uint72",
  "uint80",
  "uint88",
  "uint96",
  "uint104",
  "uint112",
  "uint120",
  "uint128",
  "uint136",
  "uint144",
  "uint152",
  "uint160",
  "uint168",
  "uint176",
  "uint184",
  "uint192",
  "uint200",
  "uint208",
  "uint216",
  "uint224",
  "uint232",
  "uint240",
  "uint248",
  "uint256",
  "int8",
  "int16",
  "int24",
  "int32",
  "int40",
  "int48",
  "int56",
  "int64",
  "int72",
  "int80",
  "int88",
  "int96",
  "int104",
  "int112",
  "int120",
  "int128",
  "int136",
  "int144",
  "int152",
  "int160",
  "int168",
  "int176",
  "int184",
  "int192",
  "int200",
  "int208",
  "int216",
  "int224",
  "int232",
  "int240",
  "int248",
  "int256",
  "bytes1",
  "bytes2",
  "bytes3",
  "bytes4",
  "bytes5",
  "bytes6",
  "bytes7",
  "bytes8",
  "bytes9",
  "bytes10",
  "bytes11",
  "bytes12",
  "bytes13",
  "bytes14",
  "bytes15",
  "bytes16",
  "bytes17",
  "bytes18",
  "bytes19",
  "bytes20",
  "bytes21",
  "bytes22",
  "bytes23",
  "bytes24",
  "bytes25",
  "bytes26",
  "bytes27",
  "bytes28",
  "bytes29",
  "bytes30",
  "bytes31",
  "bytes32",
  "bool",
  "address",
  "uint8[]",
  "uint16[]",
  "uint24[]",
  "uint32[]",
  "uint40[]",
  "uint48[]",
  "uint56[]",
  "uint64[]",
  "uint72[]",
  "uint80[]",
  "uint88[]",
  "uint96[]",
  "uint104[]",
  "uint112[]",
  "uint120[]",
  "uint128[]",
  "uint136[]",
  "uint144[]",
  "uint152[]",
  "uint160[]",
  "uint168[]",
  "uint176[]",
  "uint184[]",
  "uint192[]",
  "uint200[]",
  "uint208[]",
  "uint216[]",
  "uint224[]",
  "uint232[]",
  "uint240[]",
  "uint248[]",
  "uint256[]",
  "int8[]",
  "int16[]",
  "int24[]",
  "int32[]",
  "int40[]",
  "int48[]",
  "int56[]",
  "int64[]",
  "int72[]",
  "int80[]",
  "int88[]",
  "int96[]",
  "int104[]",
  "int112[]",
  "int120[]",
  "int128[]",
  "int136[]",
  "int144[]",
  "int152[]",
  "int160[]",
  "int168[]",
  "int176[]",
  "int184[]",
  "int192[]",
  "int200[]",
  "int208[]",
  "int216[]",
  "int224[]",
  "int232[]",
  "int240[]",
  "int248[]",
  "int256[]",
  "bytes1[]",
  "bytes2[]",
  "bytes3[]",
  "bytes4[]",
  "bytes5[]",
  "bytes6[]",
  "bytes7[]",
  "bytes8[]",
  "bytes9[]",
  "bytes10[]",
  "bytes11[]",
  "bytes12[]",
  "bytes13[]",
  "bytes14[]",
  "bytes15[]",
  "bytes16[]",
  "bytes17[]",
  "bytes18[]",
  "bytes19[]",
  "bytes20[]",
  "bytes21[]",
  "bytes22[]",
  "bytes23[]",
  "bytes24[]",
  "bytes25[]",
  "bytes26[]",
  "bytes27[]",
  "bytes28[]",
  "bytes29[]",
  "bytes30[]",
  "bytes31[]",
  "bytes32[]",
  "bool[]",
  "address[]",
  "bytes",
  "string",
] as const;

/* ----------------------------- STATIC/DYNAMIC ----------------------------- */
// These are defined here to keep the index position (98) consolidated, since we use it both in runtime code and type definition
const staticAbiTypes = abiTypes.slice(0, 98) as any as TupleSplit<typeof abiTypes, 98>[0];
const dynamicAbiTypes = abiTypes.slice(98) as any as TupleSplit<typeof abiTypes, 98>[1];

type StaticAbiType = (typeof staticAbiTypes)[number];
type DynamicAbiType = (typeof dynamicAbiTypes)[number];

type StaticPrimitiveType = number | bigint | boolean | Hex;

const staticAbiTypeToDefaultValue = {
  uint8: 0,
  uint16: 0,
  uint24: 0,
  uint32: 0,
  uint40: 0,
  uint48: 0,
  uint56: 0n,
  uint64: 0n,
  uint72: 0n,
  uint80: 0n,
  uint88: 0n,
  uint96: 0n,
  uint104: 0n,
  uint112: 0n,
  uint120: 0n,
  uint128: 0n,
  uint136: 0n,
  uint144: 0n,
  uint152: 0n,
  uint160: 0n,
  uint168: 0n,
  uint176: 0n,
  uint184: 0n,
  uint192: 0n,
  uint200: 0n,
  uint208: 0n,
  uint216: 0n,
  uint224: 0n,
  uint232: 0n,
  uint240: 0n,
  uint248: 0n,
  uint256: 0n,

  int8: 0,
  int16: 0,
  int24: 0,
  int32: 0,
  int40: 0,
  int48: 0,
  int56: 0n,
  int64: 0n,
  int72: 0n,
  int80: 0n,
  int88: 0n,
  int96: 0n,
  int104: 0n,
  int112: 0n,
  int120: 0n,
  int128: 0n,
  int136: 0n,
  int144: 0n,
  int152: 0n,
  int160: 0n,
  int168: 0n,
  int176: 0n,
  int184: 0n,
  int192: 0n,
  int200: 0n,
  int208: 0n,
  int216: 0n,
  int224: 0n,
  int232: 0n,
  int240: 0n,
  int248: 0n,
  int256: 0n,

  bytes1: "0x00",
  bytes2: "0x0000",
  bytes3: "0x000000",
  bytes4: "0x00000000",
  bytes5: "0x0000000000",
  bytes6: "0x000000000000",
  bytes7: "0x00000000000000",
  bytes8: "0x0000000000000000",
  bytes9: "0x000000000000000000",
  bytes10: "0x00000000000000000000",
  bytes11: "0x0000000000000000000000",
  bytes12: "0x000000000000000000000000",
  bytes13: "0x00000000000000000000000000",
  bytes14: "0x0000000000000000000000000000",
  bytes15: "0x000000000000000000000000000000",
  bytes16: "0x00000000000000000000000000000000",
  bytes17: "0x0000000000000000000000000000000000",
  bytes18: "0x000000000000000000000000000000000000",
  bytes19: "0x00000000000000000000000000000000000000",
  bytes20: "0x0000000000000000000000000000000000000000",
  bytes21: "0x000000000000000000000000000000000000000000",
  bytes22: "0x00000000000000000000000000000000000000000000",
  bytes23: "0x0000000000000000000000000000000000000000000000",
  bytes24: "0x000000000000000000000000000000000000000000000000",
  bytes25: "0x00000000000000000000000000000000000000000000000000",
  bytes26: "0x0000000000000000000000000000000000000000000000000000",
  bytes27: "0x000000000000000000000000000000000000000000000000000000",
  bytes28: "0x00000000000000000000000000000000000000000000000000000000",
  bytes29: "0x0000000000000000000000000000000000000000000000000000000000",
  bytes30: "0x000000000000000000000000000000000000000000000000000000000000",
  bytes31: "0x00000000000000000000000000000000000000000000000000000000000000",
  bytes32: "0x0000000000000000000000000000000000000000000000000000000000000000",

  bool: false,
  address: "0x0000000000000000000000000000000000000000",
} as const satisfies Record<StaticAbiType, StaticPrimitiveType>;

type StaticAbiTypeToPrimitiveType<TStaticAbiType extends StaticAbiType = StaticAbiType> = LiteralToBroad<
  (typeof staticAbiTypeToDefaultValue)[TStaticAbiType]
>;

type DynamicPrimitiveType = readonly number[] | readonly bigint[] | readonly Hex[] | readonly boolean[] | Hex | string;

const dynamicAbiTypeToDefaultValue = {
  "uint8[]": [] as readonly number[],
  "uint16[]": [] as readonly number[],
  "uint24[]": [] as readonly number[],
  "uint32[]": [] as readonly number[],
  "uint40[]": [] as readonly number[],
  "uint48[]": [] as readonly number[],
  "uint56[]": [] as readonly bigint[],
  "uint64[]": [] as readonly bigint[],
  "uint72[]": [] as readonly bigint[],
  "uint80[]": [] as readonly bigint[],
  "uint88[]": [] as readonly bigint[],
  "uint96[]": [] as readonly bigint[],
  "uint104[]": [] as readonly bigint[],
  "uint112[]": [] as readonly bigint[],
  "uint120[]": [] as readonly bigint[],
  "uint128[]": [] as readonly bigint[],
  "uint136[]": [] as readonly bigint[],
  "uint144[]": [] as readonly bigint[],
  "uint152[]": [] as readonly bigint[],
  "uint160[]": [] as readonly bigint[],
  "uint168[]": [] as readonly bigint[],
  "uint176[]": [] as readonly bigint[],
  "uint184[]": [] as readonly bigint[],
  "uint192[]": [] as readonly bigint[],
  "uint200[]": [] as readonly bigint[],
  "uint208[]": [] as readonly bigint[],
  "uint216[]": [] as readonly bigint[],
  "uint224[]": [] as readonly bigint[],
  "uint232[]": [] as readonly bigint[],
  "uint240[]": [] as readonly bigint[],
  "uint248[]": [] as readonly bigint[],
  "uint256[]": [] as readonly bigint[],

  "int8[]": [] as readonly number[],
  "int16[]": [] as readonly number[],
  "int24[]": [] as readonly number[],
  "int32[]": [] as readonly number[],
  "int40[]": [] as readonly number[],
  "int48[]": [] as readonly number[],
  "int56[]": [] as readonly bigint[],
  "int64[]": [] as readonly bigint[],
  "int72[]": [] as readonly bigint[],
  "int80[]": [] as readonly bigint[],
  "int88[]": [] as readonly bigint[],
  "int96[]": [] as readonly bigint[],
  "int104[]": [] as readonly bigint[],
  "int112[]": [] as readonly bigint[],
  "int120[]": [] as readonly bigint[],
  "int128[]": [] as readonly bigint[],
  "int136[]": [] as readonly bigint[],
  "int144[]": [] as readonly bigint[],
  "int152[]": [] as readonly bigint[],
  "int160[]": [] as readonly bigint[],
  "int168[]": [] as readonly bigint[],
  "int176[]": [] as readonly bigint[],
  "int184[]": [] as readonly bigint[],
  "int192[]": [] as readonly bigint[],
  "int200[]": [] as readonly bigint[],
  "int208[]": [] as readonly bigint[],
  "int216[]": [] as readonly bigint[],
  "int224[]": [] as readonly bigint[],
  "int232[]": [] as readonly bigint[],
  "int240[]": [] as readonly bigint[],
  "int248[]": [] as readonly bigint[],
  "int256[]": [] as readonly bigint[],

  "bytes1[]": [] as readonly Hex[],
  "bytes2[]": [] as readonly Hex[],
  "bytes3[]": [] as readonly Hex[],
  "bytes4[]": [] as readonly Hex[],
  "bytes5[]": [] as readonly Hex[],
  "bytes6[]": [] as readonly Hex[],
  "bytes7[]": [] as readonly Hex[],
  "bytes8[]": [] as readonly Hex[],
  "bytes9[]": [] as readonly Hex[],
  "bytes10[]": [] as readonly Hex[],
  "bytes11[]": [] as readonly Hex[],
  "bytes12[]": [] as readonly Hex[],
  "bytes13[]": [] as readonly Hex[],
  "bytes14[]": [] as readonly Hex[],
  "bytes15[]": [] as readonly Hex[],
  "bytes16[]": [] as readonly Hex[],
  "bytes17[]": [] as readonly Hex[],
  "bytes18[]": [] as readonly Hex[],
  "bytes19[]": [] as readonly Hex[],
  "bytes20[]": [] as readonly Hex[],
  "bytes21[]": [] as readonly Hex[],
  "bytes22[]": [] as readonly Hex[],
  "bytes23[]": [] as readonly Hex[],
  "bytes24[]": [] as readonly Hex[],
  "bytes25[]": [] as readonly Hex[],
  "bytes26[]": [] as readonly Hex[],
  "bytes27[]": [] as readonly Hex[],
  "bytes28[]": [] as readonly Hex[],
  "bytes29[]": [] as readonly Hex[],
  "bytes30[]": [] as readonly Hex[],
  "bytes31[]": [] as readonly Hex[],
  "bytes32[]": [] as readonly Hex[],

  "bool[]": [] as readonly boolean[],
  "address[]": [] as readonly Hex[],

  bytes: "0x",
  string: "",
} as const satisfies Record<DynamicAbiType, DynamicPrimitiveType>;

type DynamicAbiTypeToPrimitiveType<TDynamicAbiType extends DynamicAbiType = DynamicAbiType> = LiteralToBroad<
  (typeof dynamicAbiTypeToDefaultValue)[TDynamicAbiType]
>;

/* ---------------------------------- UTILS --------------------------------- */
type LiteralToBroad<T> =
  T extends Readonly<Array<infer Element>>
    ? readonly LiteralToBroad<Element>[]
    : T extends Array<infer Element>
      ? LiteralToBroad<Element>[]
      : T extends number
        ? number
        : T extends bigint
          ? bigint
          : T extends Hex
            ? Hex
            : T extends boolean
              ? boolean
              : T extends string
                ? string
                : never;

type TupleSplit<T, N extends number, O extends readonly any[] = readonly []> = O["length"] extends N
  ? [O, T]
  : T extends readonly [infer F, ...infer R]
    ? TupleSplit<readonly [...R], N, readonly [...O, F]>
    : [O, T];

/* --------------------------------- EXPORTS -------------------------------- */
export type AbiType = (typeof abiTypes)[number];

/**
 * Infer a TypeScript type (an enum associated with the type) from an ABI type.
 */
export type AbiTypeToPrimitiveType<T extends AbiType> = LiteralToBroad<(typeof abiTypeToDefaultValue)[T]>;

const abiTypeToDefaultValue = {
  ...staticAbiTypeToDefaultValue,
  ...dynamicAbiTypeToDefaultValue,
} as const satisfies Record<AbiType, StaticAbiTypeToPrimitiveType | DynamicAbiTypeToPrimitiveType>;
