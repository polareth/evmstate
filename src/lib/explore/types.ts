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
export type ParseSolidityType<TypeId extends string, Types extends SolcStorageLayoutTypes> = TypeId extends keyof Types
  ? Types[TypeId] extends { label: infer Label extends string }
    ? Label
    : never
  : TypeId;
/* -------------------------------------------------------------------------- */
/*                           TYPE EXTRACTION UTILITIES                        */
/* -------------------------------------------------------------------------- */

/** Extract key type from a mapping declaration */
export type ExtractMappingKeyType<T extends string> = T extends `mapping(${infer KeyType} => ${string})`
  ? KeyType
  : never;

/** Extract value type from a mapping declaration */
export type ExtractMappingValueType<T extends string> = T extends `mapping(${string} => ${infer ValueType})`
  ? ValueType
  : never;

/** Extract base type from an array declaration */
export type ExtractArrayBaseType<T extends string> = T extends `${infer BaseType}[]` | `${infer BaseType}[${string}]`
  ? BaseType
  : never;

/** Extract struct member names from a struct type */
export type ExtractStructMembers<StructName extends string, Types extends Record<string, any>> = {
  [TypeId in keyof Types]: Types[TypeId] extends { label: infer Label extends string }
    ? Label extends `struct ${StructName}`
      ? Types[TypeId] extends { members: readonly any[] }
        ? Types[TypeId]["members"][number]["label"]
        : never
      : never
    : never;
}[keyof Types];

/** Helper type to get the type of a struct member */
export type ExtractStructMemberType<
  StructName extends string,
  MemberName extends string,
  Types extends SolcStorageLayoutTypes,
> = {
  [TypeId in keyof Types]: Types[TypeId] extends { label: infer Label extends string }
    ? Label extends `struct ${StructName}`
      ? Types[TypeId] extends { members: readonly any[] }
        ? {
            [MemberIndex in keyof Types[TypeId]["members"]]: Types[TypeId]["members"][MemberIndex] extends {
              label: infer MLabel extends string;
            }
              ? MLabel extends MemberName
                ? ParseSolidityType<
                    Types[TypeId]["members"][MemberIndex] extends { type: infer T extends string } ? T : never,
                    Types
                  >
                : never
              : never;
          }[keyof Types[TypeId]["members"]]
        : never
      : never
    : never;
}[keyof Types];

/* -------------------------------------------------------------------------- */
/*                           STORAGE DATA TYPE MAPPING                        */
/* -------------------------------------------------------------------------- */

/**
 * Map Solidity types to TypeScript return types
 *
 * This is an opinionated way to retrieve primitive types, e.g. uint256 -> bigint but uint256[] -> bigint as well. A
 * struct returns the type of any member. It always traverses until the very last primitive type.
 */
export type SolidityTypeToTsType<T extends string, Types extends SolcStorageLayoutTypes> =
  // Handle primitive types
  T extends AbiTypeInplace
    ? AbiTypeToPrimitiveType<T>
    : // Handle mappings (return value type)
      T extends `mapping(${string} => ${string})`
      ? SolidityTypeToTsType<ExtractMappingValueType<T>, Types>
      : // Handle arrays
        T extends `${string}[]` | `${string}[${string}]`
        ? SolidityTypeToTsType<ExtractArrayBaseType<T>, Types> | bigint // Add bigint for array length
        : // Handle struct types - use a union of all member types
          T extends `struct ${infer StructName}`
          ? ExtractStructMembers<StructName, Types> extends infer Members
            ? Members extends string
              ? SolidityTypeToTsType<ExtractStructMemberType<StructName, Members, Types> & string, Types>
              : unknown
            : unknown
          : // Handle bytes/string
            T extends "bytes" | "string"
            ? string | bigint // Add bigint for length
            : // Default case
              unknown;

/* -------------------------------------------------------------------------- */
/*                            MAPPING TYPE HELPERS                            */
/* -------------------------------------------------------------------------- */
/** The following types are not used in the library, but can be useful as utility types */

/** Extract mapping key types with their corresponding TypeScript types */
export type GetMappingKeyTypePairs<
  T extends string,
  Types extends SolcStorageLayoutTypes,
  Result extends readonly [string, any][] = [],
> = T extends `mapping(${infer KeyType} => ${infer ValueType})`
  ? ValueType extends `mapping(${string} => ${string})`
    ? GetMappingKeyTypePairs<
        ValueType,
        Types,
        [...Result, [KeyType, KeyType extends AbiType ? AbiTypeToPrimitiveType<KeyType> : never]]
      >
    : [...Result, [KeyType, KeyType extends AbiType ? AbiTypeToPrimitiveType<KeyType> : never]]
  : Result;

/** Get just the Solidity type strings for mapping keys as a tuple */
export type GetMappingKeyTypes<T extends string, Types extends SolcStorageLayoutTypes> =
  GetMappingKeyTypePairs<T, Types> extends readonly [...infer Pairs]
    ? { [K in keyof Pairs]: Pairs[K] extends [infer SolType, any] ? SolType : never }
    : [];

/** Get just the TypeScript types for mapping keys as a tuple */
export type GetMappingKeyTsTypes<T extends string, Types extends SolcStorageLayoutTypes> =
  GetMappingKeyTypePairs<T, Types> extends readonly [...infer Pairs]
    ? { [K in keyof Pairs]: Pairs[K] extends [string, infer TsType] ? TsType : never }
    : [];

/**
 * Create a tuple type of mapping keys with their types (for display/debugging) Each element has both type and value
 * properties
 */
export type GetMappingKeysTuple<T extends string, Types extends SolcStorageLayoutTypes> =
  GetMappingKeyTypePairs<T, Types> extends readonly [...infer Pairs]
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
export type StructFieldSegment<StructName extends string, Types extends SolcStorageLayoutTypes> = {
  kind: PathSegmentKind.StructField;
  name: ExtractStructMembers<StructName, Types>;
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
export type MappingKeySegment<KeyType extends string, Types extends SolcStorageLayoutTypes> = {
  kind: PathSegmentKind.MappingKey;
  key: SolidityTypeToTsType<KeyType, Types>;
  keyType: KeyType;
};

/**
 * A type that builds path segments incrementally for any Solidity type.
 *
 * It handles one "layer" at a time and recursively processes inner types
 */
export type PathBuilder<
  T extends string,
  Types extends SolcStorageLayoutTypes,
  BasePath extends readonly PathSegment[] = [],
> =
  // Base case - if we've reached a primitive type, return the accumulated path
  T extends AbiTypeInplace
    ? BasePath
    : // Handle mapping types - add mapping key segment and recurse with value type
      T extends `mapping(${infer KeyType} => ${infer ValueType})`
      ? PathBuilder<
          ValueType,
          Types,
          [
            ...BasePath,
            {
              kind: PathSegmentKind.MappingKey;
              key: KeyType extends AbiTypeInplace ? AbiTypeToPrimitiveType<KeyType> : never;
              keyType: KeyType;
            },
          ]
        >
      : // Handle array types - add array index segment and recurse with base type
        T extends `${infer BaseType}[]` | `${infer BaseType}[${string}]`
        ? PathBuilder<BaseType, Types, [...BasePath, ArrayIndexSegment]> | [...BasePath, ArrayLengthSegment]
        : // Handle struct types - distribute over members, add struct field segment, and recurse with member type
          T extends `struct ${infer StructName}`
          ? {
              [Member in ExtractStructMembers<StructName, Types> & string]: PathBuilder<
                ExtractStructMemberType<StructName, Member, Types> & string,
                Types,
                [...BasePath, { kind: PathSegmentKind.StructField; name: Member }]
              >;
            }[ExtractStructMembers<StructName, Types> & string]
          : // Handle bytes/string types - add bytes length segment
            T extends "bytes" | "string"
            ? BasePath | [...BasePath, BytesLengthSegment]
            : // Default case - unknown type, return base path
              BasePath;

/** Get all possible path segments for a variable type */
export type VariablePathSegments<T extends string, Types extends SolcStorageLayoutTypes> = PathBuilder<T, Types>;

/** Convert a path segment to its string representation */
export type PathSegmentToString<Segment> = Segment extends { kind: PathSegmentKind.MappingKey; key: infer Key }
  ? `[${Key & (string | number | bigint | boolean)}]`
  : Segment extends { kind: PathSegmentKind.ArrayLength }
    ? `._length`
    : Segment extends { kind: PathSegmentKind.BytesLength }
      ? `._length`
      : Segment extends { kind: PathSegmentKind.ArrayIndex; index: infer Index }
        ? `[${Index & (string | number | bigint)}]`
        : Segment extends { kind: PathSegmentKind.StructField; name: infer Name }
          ? `.${Name & string}`
          : never;

/**
 * Generate a full expression from a variable name and path segments This type correctly handles all path segments in
 * the correct order
 */
export type FullExpression<Name extends string, Path extends any[]> = Path extends []
  ? Name
  : Path extends [infer First, ...infer Rest]
    ? FullExpression<`${Name}${PathSegmentToString<First>}`, Rest extends any[] ? Rest : []>
    : Name;

/** Generate a full expression for a variable */
export type VariableExpression<
  Name extends string,
  T extends string,
  Types extends SolcStorageLayoutTypes,
> = FullExpression<Name, VariablePathSegments<T, Types>>;

/** Generic path segment type */
export type PathSegment =
  | { kind: PathSegmentKind.StructField; name: string }
  | { kind: PathSegmentKind.ArrayIndex; index: bigint }
  | {
      kind: PathSegmentKind.MappingKey;
      key: AbiTypeToPrimitiveType<AbiTypeInplace>;
      keyType: string;
    }
  | { kind: PathSegmentKind.ArrayLength; name: "_length" }
  | { kind: PathSegmentKind.BytesLength; name: "_length" };

/* -------------------------------------------------------------------------- */
/*                               INTERNAL TYPES                               */
/* -------------------------------------------------------------------------- */

/** Mapping key type */
export interface MappingKey<T extends AbiType = AbiType> {
  // Value padded to 32 bytes
  hex: Hex;
  // Type of the value if known
  type?: T;
  // Decoded value if known
  decoded?: AbiTypeToPrimitiveType<T>;
}

/** A subset of AbiType with only inplace types */
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
