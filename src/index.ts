export { traceState, Tracer } from "@/lib/trace/index.js";
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
} from "@/lib/explore/types.js";
export { PathSegmentKind } from "@/lib/explore/types.js";
export type { ExploreStorageConfig } from "@/lib/explore/config.js";

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
} from "@/lib/trace/types.js";

export { watchState } from "@/lib/watch/index.js";
export type { WatchStateOptions, StateChange } from "@/lib/watch/types.js";

export type { SolcStorageLayout } from "tevm/bundler/solc";
