export { traceState, Tracer } from "@/lib/trace";
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
export type { ExploreStorageConfig } from "@/lib/explore/config";

export type {
  // Options
  TraceStateOptions,
  TraceStateBaseOptions,
  TraceStateTxParams,
  TraceStateTxWithAbi,
  TraceStateTxWithData,
  TraceStateTxWithReplay,
  // Trace
  LabeledStateDiff,
  LabeledStorageDiff,
  LabeledStorageDiffTrace,
  LabeledIntrinsicsDiff,
} from "@/lib/trace/types";

export { watchState } from "@/lib/watch";
export type { WatchStateOptions, StateChange } from "@/lib/watch/types";
