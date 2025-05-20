import {
  encodeFunctionData,
  type Abi,
  type Address,
  type ContractFunctionName,
  type Hex,
  type MemoryClient,
} from "tevm";
import {
  type AccountState,
  type DebugTraceBlockResult,
  type PrestateTraceResult,
  type TraceResult,
} from "tevm/actions";

import type { LabeledIntrinsicsState, TraceStateOptions } from "@/lib/trace/types.js";

export const debugTraceTransaction = async <
  TAbi extends Abi | readonly unknown[] = Abi,
  TFunctionName extends ContractFunctionName<TAbi> = ContractFunctionName<TAbi>,
>(
  client: MemoryClient,
  params: TraceStateOptions<TAbi, TFunctionName>,
): Promise<{
  stateDiff: Record<
    Address,
    LabeledIntrinsicsState & { storage: Record<Hex, { current?: Hex; next?: Hex; modified: boolean }> }
  >;
  structLogs: TraceResult["structLogs"];
  addresses: Array<Address>;
  newAddresses: Array<Address>;
}> => {
  const { from, to, value, abi, functionName, args, txHash } = params;
  const data =
    abi && functionName
      ? // @ts-expect-error not assignable to union type
        encodeFunctionData({ abi, functionName, args: args ?? [] })
      : params.data;

  // Trace a call with params
  try {
    let stateTraceResult: PrestateTraceResult<true>;
    let callTraceResult: TraceResult;

    if (txHash) {
      stateTraceResult = await client.transport.tevm.request({
        method: "debug_traceTransaction",
        params: [{ transactionHash: txHash, tracer: "prestateTracer", tracerConfig: { diffMode: true } }],
      });
      callTraceResult = await client.transport.tevm.request({
        method: "debug_traceTransaction",
        params: [{ transactionHash: txHash }],
      });
    } else {
      stateTraceResult = await client.transport.tevm.request({
        method: "debug_traceCall",
        params: [{ from, to, data, value, tracer: "prestateTracer", tracerConfig: { diffMode: true } }],
      });
      callTraceResult = await client.transport.tevm.request({
        method: "debug_traceCall",
        params: [{ from, to, data, value }],
      });
    }

    const preAddresses = Object.keys(stateTraceResult?.pre ?? {});
    const newAddresses = Object.keys(stateTraceResult?.post ?? {}).filter((address) => !preAddresses.includes(address));
    return {
      stateDiff: stateTraceResult
        ? stateDiff({ ...stateTraceResult, addresses: preAddresses.concat(newAddresses) as Array<Address> })
        : {},
      structLogs: callTraceResult ? callTraceResult.structLogs : [],
      addresses: preAddresses as Array<Address>,
      newAddresses: newAddresses as Array<Address>,
    };
  } catch (err) {
    throw new Error(`Failed to trace transaction: ${err instanceof Error ? err.message : JSON.stringify(err)}`);
  }
};

export const debugTraceBlock = async (
  client: MemoryClient,
  blockHash: Hex,
): Promise<
  Array<{
    txHash: Hex;
    stateDiff: Record<
      Address,
      LabeledIntrinsicsState & { storage: Record<Hex, { current?: Hex; next?: Hex; modified: boolean }> }
    >;
    structLogs: TraceResult["structLogs"];
    addresses: Array<Address>;
    newAddresses: Array<Address>;
  }>
> => {
  try {
    const blockStateTraceResult = (await client.transport.tevm.request({
      method: "debug_traceBlock",
      params: [{ blockHash, tracer: "prestateTracer", tracerConfig: { diffMode: true } }],
    })) as DebugTraceBlockResult<"prestateTracer", true>;
    const blockCallTraceResult = (await client.transport.tevm.request({
      method: "debug_traceBlock",
      params: [{ blockHash }],
    })) as DebugTraceBlockResult<undefined, false>;

    return blockStateTraceResult.map((stateTraceResult) => {
      const callTraceResult = blockCallTraceResult.find((result) => result.txHash === stateTraceResult.txHash);
      if (!callTraceResult) {
        throw new Error(`No call trace result found for transaction ${stateTraceResult.txHash}`);
      }

      const preAddresses = Object.keys(stateTraceResult.result.pre ?? {});
      const newAddresses = Object.keys(stateTraceResult.result.post ?? {}).filter(
        (address) => !preAddresses.includes(address),
      );
      return {
        txHash: stateTraceResult.txHash,
        stateDiff: stateTraceResult
          ? stateDiff({ ...stateTraceResult.result, addresses: preAddresses.concat(newAddresses) as Array<Address> })
          : {},
        structLogs: callTraceResult ? callTraceResult.result.structLogs : [],
        addresses: preAddresses as Array<Address>,
        newAddresses: newAddresses as Array<Address>,
      };
    });
  } catch (err) {
    throw new Error(`Failed to trace block: ${err instanceof Error ? err.message : JSON.stringify(err)}`);
  }
};

const stateDiff = ({ pre, post, addresses }: PrestateTraceResult<true> & { addresses: Array<Address> }) => {
  return addresses.reduce(
    (acc, address) => {
      const { storage: preStorage, ...preIntrinsics }: AccountState | undefined = pre[address] ?? {};
      const { storage: postStorage, ...postIntrinsics }: Partial<AccountState> | undefined = post[address] ?? {};
      const uniqueSlots = new Set([...Object.keys(preStorage ?? {}), ...Object.keys(postStorage ?? {})]) as Set<Hex>;

      // If values are different, it's a write (with both current and next)
      // Otherwise, it's a read (with only current)
      acc[address as Hex] = {
        ...(Object.fromEntries(
          Object.entries(preIntrinsics).map(([_key, preValue]) => {
            const key = _key as keyof typeof preIntrinsics;
            const postValue = postIntrinsics?.[key];
            return [
              key,
              {
                ...(preValue !== undefined ? { current: key === "balance" ? BigInt(preValue) : preValue } : {}),
                ...(postValue !== undefined ? { next: key === "balance" ? BigInt(postValue) : postValue } : {}),
                modified: postValue !== undefined && preValue !== undefined && postValue !== preValue,
              },
            ];
          }),
        ) as LabeledIntrinsicsState),
        storage: Object.fromEntries(
          [...uniqueSlots].map((slot) => {
            const preValue = preStorage?.[slot as Hex];
            const postValue = postStorage?.[slot as Hex];
            return [
              slot,
              {
                ...(preValue !== undefined ? { current: preValue } : {}),
                ...(postValue !== undefined ? { next: postValue } : {}),
                modified: postValue !== undefined && preValue !== undefined && postValue !== preValue,
              },
            ];
          }),
        ),
      };

      return acc;
    },
    {} as Record<
      Address,
      LabeledIntrinsicsState & { storage: Record<Hex, { current?: Hex; next?: Hex; modified: boolean }> }
    >,
  );
};
