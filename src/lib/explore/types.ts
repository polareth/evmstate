import { Hex } from "tevm";
import { SolcStorageLayoutTypes } from "tevm/bundler/solc";
import { AbiType, AbiTypeToPrimitiveType, SolidityAddress, SolidityBool, SolidityInt } from "abitype";

/* -------------------------------------------------------------------------- */
/*                              TYPE HELPERS                                  */
/* -------------------------------------------------------------------------- */

/** Makes all properties of an object readonly deeply */
export type DeepReadonly<T> = T extends (infer R)[]
  ? ReadonlyArray<DeepReadonly<R>>
  : T extends Function
    ? T
    : T extends object
      ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
      : T;

/** Extract the final value ABI type from a solc type ID */
export type ParseSolidityType<
  TTypeId extends string,
  TTypes extends SolcStorageLayoutTypes,
> = TTypeId extends keyof TTypes
  ? TTypes[TTypeId] extends { label: infer Label extends string }
    ? Label
    : never
  : TTypeId;

/* -------------------------------------------------------------------------- */
/*                           TYPE EXTRACTION UTILITIES                        */
/* -------------------------------------------------------------------------- */

/** Extract key type from a mapping declaration */
export type ExtractMappingKeyType<TTypeLabel extends string> =
  TTypeLabel extends `mapping(${infer KeyType} => ${string})` ? KeyType : never;

/** Extract value type from a mapping declaration */
export type ExtractMappingValueType<TTypeLabel extends string> =
  TTypeLabel extends `mapping(${string} => ${infer ValueType})` ? ValueType : never;

/** Extract base type from an array declaration */
export type ExtractArrayBaseType<TTypeLabel extends string> = TTypeLabel extends
  | `${infer BaseType}[]`
  | `${infer BaseType}[${string}]`
  ? BaseType
  : never;

/** Extract struct member names from a struct type */
export type ExtractStructMembers<StructName extends string, TTypes extends Record<string, any>> = {
  [TTypeId in keyof TTypes]: TTypes[TTypeId] extends { label: infer Label extends string }
    ? Label extends `struct ${StructName}`
      ? TTypes[TTypeId] extends { members: readonly any[] }
        ? TTypes[TTypeId]["members"][number]["label"]
        : never
      : never
    : never;
}[keyof TTypes];

/** Helper type to get the type of a struct member */
export type ExtractStructMemberType<
  StructName extends string,
  MemberName extends string,
  TTypes extends SolcStorageLayoutTypes,
> = {
  [TTypeId in keyof TTypes]: TTypes[TTypeId] extends { label: infer Label extends string }
    ? Label extends `struct ${StructName}`
      ? TTypes[TTypeId] extends { members: readonly any[] }
        ? {
            [MemberIndex in keyof TTypes[TTypeId]["members"]]: TTypes[TTypeId]["members"][MemberIndex] extends {
              label: infer MLabel extends string;
            }
              ? MLabel extends MemberName
                ? ParseSolidityType<
                    TTypes[TTypeId]["members"][MemberIndex] extends { type: infer T extends string } ? T : never,
                    TTypes
                  >
                : never
              : never;
          }[keyof TTypes[TTypeId]["members"]]
        : never
      : never
    : never;
}[keyof TTypes];

/* -------------------------------------------------------------------------- */
/*                           STORAGE DATA TYPE MAPPING                        */
/* -------------------------------------------------------------------------- */

/**
 * Map Solidity types to TypeScript return types
 *
 * This is an opinionated way to retrieve primitive types, e.g. uint256 -> bigint but uint256[] -> bigint as well. A
 * struct returns the type of any member. It always traverses until the very last primitive type.
 */
export type SolidityTypeToTsType<TAbiType extends string, TTypes extends SolcStorageLayoutTypes> =
  // Handle primitive TTypes
  TAbiType extends AbiTypeInplace
    ? AbiTypeToPrimitiveType<TAbiType>
    : // Handle mappings (return value type)
      TAbiType extends `mapping(${string} => ${string})`
      ? SolidityTypeToTsType<ExtractMappingValueType<TAbiType>, TTypes>
      : // Handle arrays
        TAbiType extends `${string}[]` | `${string}[${string}]`
        ? SolidityTypeToTsType<ExtractArrayBaseType<TAbiType>, TTypes> | bigint // Add bigint for array length
        : // Handle struct TTypes - use a union of all member TTypes
          TAbiType extends `struct ${infer StructName}`
          ? ExtractStructMembers<StructName, TTypes> extends infer Members
            ? Members extends string
              ? SolidityTypeToTsType<ExtractStructMemberType<StructName, Members, TTypes> & string, TTypes>
              : unknown
            : unknown
          : // Handle bytes/string
            TAbiType extends "bytes" | "string"
            ? string | bigint // Add bigint for length
            : // Default case
              unknown;

/* -------------------------------------------------------------------------- */
/*                            MAPPING TYPE HELPERS                            */
/* -------------------------------------------------------------------------- */
/** The following types are not used in the library, but can be useful as utility types */

/** Extract mapping key TTypes with their corresponding TypeScript TTypes */
export type GetMappingKeyTypePairs<
  TTypeLabel extends string,
  TTypes extends SolcStorageLayoutTypes,
  Result extends readonly [string, any][] = [],
> = TTypeLabel extends `mapping(${infer KeyType} => ${infer ValueType})`
  ? ValueType extends `mapping(${string} => ${string})`
    ? GetMappingKeyTypePairs<
        ValueType,
        TTypes,
        [...Result, [KeyType, KeyType extends AbiType ? AbiTypeToPrimitiveType<KeyType> : never]]
      >
    : [...Result, [KeyType, KeyType extends AbiType ? AbiTypeToPrimitiveType<KeyType> : never]]
  : Result;

/** Get just the Solidity type strings for mapping keys as a tuple */
export type GetMappingKeyTypes<TTypeLabel extends string, TTypes extends SolcStorageLayoutTypes> =
  GetMappingKeyTypePairs<TTypeLabel, TTypes> extends readonly [...infer Pairs]
    ? { [K in keyof Pairs]: Pairs[K] extends [infer SolType, any] ? SolType : never }
    : [];

/** Get just the TypeScript types for mapping keys as a tuple */
export type GetMappingKeyTsTypes<TTypeLabel extends string, TTypes extends SolcStorageLayoutTypes> =
  GetMappingKeyTypePairs<TTypeLabel, TTypes> extends readonly [...infer Pairs]
    ? { [K in keyof Pairs]: Pairs[K] extends [string, infer TsType] ? TsType : never }
    : [];

/**
 * Create a tuple type of mapping keys with their types (for display/debugging) Each element has both type and value
 * properties
 */
export type GetMappingKeysTuple<TTypeLabel extends string, TTypes extends SolcStorageLayoutTypes> =
  GetMappingKeyTypePairs<TTypeLabel, TTypes> extends readonly [...infer Pairs]
    ? {
        [K in keyof Pairs]: Pairs[K] extends [infer SolType, infer TsType] ? { type: SolType; value: TsType } : never;
      }
    : [];

/* -------------------------------------------------------------------------- */
/*                               DECODED RESULTS                              */
/* -------------------------------------------------------------------------- */

export enum TypePriority {
  Primitive = 0,
  Struct = 1,
  Bytes = 2,
  StaticArray = 3,
  DynamicArray = 4,
  Mapping = 5,
}

export enum PathSegmentKind {
  StructField = "struct_field",
  ArrayIndex = "array_index",
  MappingKey = "mapping_key",
  ArrayLength = "array_length",
  BytesLength = "bytes_length",
}

/** Create a path segment for a struct field */
export type StructFieldSegment<TStructName extends string, TTypes extends SolcStorageLayoutTypes> = {
  kind: PathSegmentKind.StructField;
  name: ExtractStructMembers<TStructName, TTypes>;
};

/** Create a path segment for an array index */
export type ArrayIndexSegment = {
  kind: PathSegmentKind.ArrayIndex;
  index: bigint;
};

/** Create a path segment for an array _length */
export type ArrayLengthSegment = {
  kind: PathSegmentKind.ArrayLength;
  name: "_length";
};

/** Create a path segment for bytes/string length */
export type BytesLengthSegment = {
  kind: PathSegmentKind.BytesLength;
  name: "_length";
};

/** Create a path segment for a mapping key */
export type MappingKeySegment<TKeyType extends string, TTypes extends SolcStorageLayoutTypes> = {
  kind: PathSegmentKind.MappingKey;
  key: SolidityTypeToTsType<TKeyType, TTypes>;
  keyType: TKeyType;
};

/**
 * A type that builds path segments incrementally for any Solidity type.
 *
 * It handles one "layer" at a time and recursively processes inner TTypes
 */
export type PathBuilder<
  TTypeLabel extends string,
  TTypes extends SolcStorageLayoutTypes,
  BasePath extends readonly PathSegment[] = [],
> =
  // Base case - if we've reached a primitive type, return the accumulated path
  TTypeLabel extends AbiTypeInplace
    ? BasePath
    : // Handle mapping TTypes - add mapping key segment and recurse with value type
      TTypeLabel extends `mapping(${infer KeyType} => ${infer ValueType})`
      ? PathBuilder<
          ValueType,
          TTypes,
          [
            ...BasePath,
            {
              kind: PathSegmentKind.MappingKey;
              key: KeyType extends AbiTypeInplace ? AbiTypeToPrimitiveType<KeyType> : never;
              keyType: KeyType extends AbiTypeInplace ? KeyType : never;
            },
          ]
        >
      : // Handle array TTypes - add array index segment and recurse with base type
        TTypeLabel extends `${infer BaseType}[]` | `${infer BaseType}[${string}]`
        ? PathBuilder<BaseType, TTypes, [...BasePath, ArrayIndexSegment]> | [...BasePath, ArrayLengthSegment]
        : // Handle struct TTypes - distribute over members, add struct field segment, and recurse with member type
          TTypeLabel extends `struct ${infer StructName}`
          ? {
              [Member in ExtractStructMembers<StructName, TTypes> & string]: PathBuilder<
                ExtractStructMemberType<StructName, Member, TTypes> & string,
                TTypes,
                [...BasePath, { kind: PathSegmentKind.StructField; name: Member }]
              >;
            }[ExtractStructMembers<StructName, TTypes> & string]
          : // Handle bytes/string TTypes - add bytes length segment
            TTypeLabel extends "bytes" | "string"
            ? BasePath | [...BasePath, BytesLengthSegment]
            : // Default case - unknown type, return base path
              BasePath;

/** Get all possible path segments for a variable type */
export type VariablePathSegments<TTypeLabel extends string, TTypes extends SolcStorageLayoutTypes> = PathBuilder<
  TTypeLabel,
  TTypes
>;

/**
 * Generate a full expression from a variable name and path segments This type correctly handles all path segments in
 * the correct order
 */
export type FullExpression<Name extends string, Path extends any[]> = Path extends []
  ? Name
  : Path extends [infer First, ...infer Rest]
    ? FullExpression<`${Name}${PathSegmentToString<First>}`, Rest extends any[] ? Rest : []>
    : Name;

/** Convert a path segment to its string representation */
type PathSegmentToString<TSegment> = TSegment extends {
  kind: PathSegmentKind.MappingKey;
  key: infer Key;
}
  ? `[${Key & (string | number | bigint | boolean)}]`
  : TSegment extends { kind: PathSegmentKind.ArrayLength }
    ? `._length`
    : TSegment extends { kind: PathSegmentKind.BytesLength }
      ? `._length`
      : TSegment extends { kind: PathSegmentKind.ArrayIndex; index: infer Index }
        ? `[${Index & (string | number | bigint)}]`
        : TSegment extends { kind: PathSegmentKind.StructField; name: infer Name }
          ? `.${Name & string}`
          : never;

/** Generate a full expression for a variable */
export type VariableExpression<
  TName extends string,
  TTypeLabel extends string,
  TTypes extends SolcStorageLayoutTypes,
> = FullExpression<TName, VariablePathSegments<TTypeLabel, TTypes>>;

/** Generic path segment type */
export type PathSegment =
  | { kind: PathSegmentKind.StructField; name: string }
  | { kind: PathSegmentKind.ArrayIndex; index: bigint }
  | {
      kind: PathSegmentKind.MappingKey;
      key: AbiTypeToPrimitiveType<AbiTypeInplace>;
      keyType: AbiTypeInplace;
    }
  | { kind: PathSegmentKind.ArrayLength; name: "_length" }
  | { kind: PathSegmentKind.BytesLength; name: "_length" };

/* -------------------------------------------------------------------------- */
/*                               INTERNAL TTypes                               */
/* -------------------------------------------------------------------------- */

/** Mapping key type */
export interface MappingKey<TAbiType extends AbiType = AbiType> {
  // Value padded to 32 bytes
  hex: Hex;
  // Type of the value if known
  type?: TAbiType;
  // Decoded value if known
  decoded?: AbiTypeToPrimitiveType<TAbiType>;
}

/** A subset of AbiType with only inplace TTypes */
export type AbiTypeInplace = SolidityAddress | SolidityBool | SolidityInt | `bytes${MBytes}`;

// We need our own type as we can't omit "bytes" and use AbiTypeInplace as a subset of AbiType
// prettier-ignore
type MBytes = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 | 19 | 20 | 21 | 22 | 23 | 24 | 25 | 26 | 27 | 28 | 29 | 30 | 31 | 32;

export type DecodedResult = {
  name: string;
  type: string;
  current: { hex: Hex; decoded?: unknown };
  next?: { hex: Hex; decoded?: unknown };
  slots: Array<Hex>;
  path: Array<PathSegment>;
  note?: string;
};
