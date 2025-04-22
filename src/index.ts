export { traceStorageAccess, Tracer } from "@/lib/trace";
export type {
  // Solidity type extraction (mapping, array, struct)
  ExtractMappingKeyType,
  ExtractMappingValueType,
  ExtractArrayBaseType,
  ExtractStructMembers,
  ExtractStructMemberType,
  // Solc -> Solidity type extraction
  ParseSolidityType,
  // Solidity -> TypeScript type extraction
  SolidityTypeToTsType,
  // Mapping type helpers
  GetMappingKeyTsTypes,
  GetMappingKeyTypePairs,
  GetMappingKeyTypes,
  GetMappingKeysTuple,
  // Path segment types
  PathSegment,
  PathSegmentKind,
  VariablePathSegments,
  VariableExpression,
  FullExpression,
  ArrayIndexSegment,
  ArrayLengthSegment,
  BytesLengthSegment,
  MappingKeySegment,
  StructFieldSegment,
  // Helpers
  DeepReadonly,
  AbiTypeInplace,
} from "@/lib/explore/types";

export type {
  // Options
  TraceStorageAccessOptions,
  TraceStorageAccessTxParams,
  TraceStorageAccessTxWithAbi,
  TraceStorageAccessTxWithData,
  TraceStorageAccessTxWithReplay,
  // Trace
  StorageAccessTrace,
  LabeledStorageAccess,
  LabeledStorageAccessTrace,
  IntrinsicsDiff,
} from "@/lib/trace/types";
