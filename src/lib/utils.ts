import {
  Abi,
  Address,
  BlockTag,
  ContractFunctionName,
  createMemoryClient,
  decodeAbiParameters,
  encodeFunctionData,
  Hex,
  http,
  MemoryClient,
} from "tevm";
import { Common } from "tevm/common";
import { padHex } from "viem";

import { debug } from "@/debug";
import { AbiType, AbiTypeToPrimitiveType, StaticAbiType, staticAbiTypeToByteLength } from "@/lib/adapter/schema";
import { TraceStorageAccessOptions, TraceStorageAccessTxParams, TraceStorageAccessTxWithData } from "@/lib/types";

/** Creates a Tevm client from the provided options */
export const createClient = (options: { rpcUrl?: string; common?: Common; blockTag?: BlockTag | bigint }) => {
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

export const uniqueAddresses = (addresses: Array<Address | undefined>): Array<Address> => {
  let existingAddresses = new Set<string>();

  return addresses.filter((address) => {
    if (!address || existingAddresses.has(address.toLowerCase())) return false;
    existingAddresses.add(address.toLowerCase());
    return true;
  }) as Address[];
};

export const getUnifiedParams = async <
  TAbi extends Abi | readonly unknown[] = Abi,
  TFunctionName extends ContractFunctionName<TAbi> = ContractFunctionName<TAbi>,
>(
  args: TraceStorageAccessOptions & TraceStorageAccessTxParams<TAbi, TFunctionName>,
): Promise<TraceStorageAccessTxWithData & { client: MemoryClient }> => {
  const { client: _client, rpcUrl, common } = args;

  // Create the tevm client
  const client = _client ?? createClient({ rpcUrl, common });

  // Return early if the tx was already provided in calldata format
  if (args.from && args.data) return { client, from: args.from, to: args.to, data: args.data };

  // Encode calldata if the contract call was provided (abi, functionName, args)
  if (args.from && args.to && args.abi && args.functionName && args.args) {
    try {
      // @ts-expect-error complex union type not exactly similar
      const data = encodeFunctionData(args);
      return { client, from: args.from, to: args.to, data };
    } catch (err) {
      debug(`Failed to encode function data: ${err}`);
      throw err;
    }
  }

  // In this case, we need to replay the transaction
  if (!args.txHash)
    throw new Error("You need to provide a txHash if you don't provide the transaction data or contract call");

  // If we're replaying a transaction, extract the from, to, and data from the transaction
  try {
    const tx = await client.getTransaction({ hash: args.txHash });

    // TODO: can't run tx at past block so we need to recreate the client; this won't work on the default chain so to-test in staging
    // Also it's ugly to recreate the client here
    const clientBeforeTx = createClient({
      rpcUrl: rpcUrl ?? client.chain?.rpcUrls.default.http[0],
      common,
      blockTag: tx.blockNumber > 0 ? tx.blockNumber - BigInt(1) : BigInt(0),
    });

    return {
      client: clientBeforeTx,
      from: tx.from,
      to: tx.to ?? undefined,
      // TODO: remove when correctly formatted (tx in block mined here has data instead of input)
      // @ts-expect-error Property 'data' does not exist on type Transaction
      data: tx.input ? (tx.input as Hex) : (tx.data as Hex),
    };
  } catch (err) {
    debug(`Failed to get transaction for replaying ${args.txHash}: ${err}`);
    throw err;
  }
};

/**
 * Decode a hex string padded to 32 bytes based on its Solidity type
 *
 * @param valueHex The hex value to decode
 * @param type The Solidity type (e.g., 'uint256', 'bool', 'address')
 * @param offset The offset of the variable within the slot (for packed variables)
 * @returns The decoded value with the appropriate JavaScript type
 */
// TODO: decode all types including dynamic types
export const decodeHex = <T extends AbiType = AbiType>(
  valueHex: Hex,
  type?: T,
  offset?: number,
): { hex: Hex; decoded?: AbiTypeToPrimitiveType<T> } => {
  if (!type) return { hex: valueHex };

  try {
    const byteLength = staticAbiTypeToByteLength[type];

    // Extract the relevant part of the storage slot
    const extractedHex = extractRelevantHex(valueHex, offset ?? 0, byteLength);
    const decoded = decodeAbiParameters([{ type }], padHex(extractedHex, { size: 32 }))[0] as AbiTypeToPrimitiveType<T>;

    return { hex: extractedHex, decoded };
  } catch (error) {
    debug(`Error decoding storage value of type ${type}:`, error);
    return { hex: valueHex };
  }
};

/**
 * Extract relevant hex from a hex string based on its offset and length, especially useful for packed variables
 *
 * @param {Hex} data - The 32-byte hex string
 * @param {number} offset - The offset in bytes from the right where the value starts
 * @param {number} length - The length in bytes of the value to extract
 * @returns {Hex} - The extracted hex substring
 */
export const extractRelevantHex = (data: Hex, offset: number, length: number): Hex => {
  if (!data.startsWith("0x")) data = `0x${data}`;
  if (data === "0x" || data === "0x00") return data;

  // Fill up to 32 bytes
  data = padHex(data, { size: 32, dir: "left" });

  // Calculate start and end positions (in hex characters)
  // Each byte is 2 hex characters, and we need to account for '0x' prefix
  const totalLength = (data.length - 2) / 2; // Length in bytes (excluding 0x prefix)

  // Calculate offset from left
  const offsetFromLeft = totalLength - offset - length;

  // Calculate character positions
  const startPos = offsetFromLeft * 2 + 2; // +2 for '0x' prefix
  const endPos = startPos + length * 2;

  // Extract the substring and add 0x prefix
  return `0x${data.slice(startPos, endPos)}`;
};
