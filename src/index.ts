export { traceStorageAccess, Tracer } from "@/lib/trace";
export { findBestStorageSlotLabel } from "@/lib/slot-engine";
export type {
  StorageAccessTrace,
  TraceStorageAccessOptions,
  StorageReads,
  StorageWrites,
  IntrinsicsDiff,
  AccountDiff,
  LabeledStorageRead,
  LabeledStorageWrite,
} from "@/lib/types";
