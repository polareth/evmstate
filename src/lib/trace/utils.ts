import { createMemoryClient, http, type BlockTag, type MemoryClient } from "tevm";
import { type Common } from "tevm/common";

/** Creates a Tevm client from the provided options */
export const createClient = (options: {
  rpcUrl?: string;
  common?: Common;
  blockTag?: BlockTag | bigint;
}): MemoryClient => {
  const { rpcUrl, common, blockTag } = options;
  if (!rpcUrl) throw new Error("You need to provide a rpcUrl if you don't provide a client directly");

  return createMemoryClient({
    common,
    fork: {
      transport: http(rpcUrl),
      blockTag: blockTag ?? "latest",
    },
    miningConfig: { type: "manual" },
  });
};

/** A helper function to clean up trace objects by removing undefined or zero values */
export const cleanTrace = (obj: any) => {
  const { current, next, note, ...rest } = obj;
  let trace = { ...rest };

  // Only include note if it exists
  if (note) trace.note = note;

  // Same for current and next
  trace.current = { hex: current.hex };
  if (current.decoded !== undefined) trace.current = { hex: current.hex, decoded: current.decoded };

  if (next && rest.modified) {
    trace.next = { hex: next.hex };
    if (next.decoded !== undefined) trace.next = { hex: next.hex, decoded: next.decoded };
  }

  return trace;
};
