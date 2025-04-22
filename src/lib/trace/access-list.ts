import { Address, Hex, keccak256, MemoryClient } from "tevm";

import { debug } from "@/debug";
import { AccessList, IntrinsicsDiff, IntrinsicsSnapshot, StorageDiff, StorageSnapshot } from "@/lib/trace/types";

const EMPTY_CODE_HASH = keccak256(new Uint8Array(0));
const EMPTY_STORAGE_ROOT = "0x56e81f171bcc55a6ff8345e692c0f86e5b48e01b996cadc001622fb5e363b421";

/**
 * Fetches storage values for all slots in an access list.
 *
 * @param client - The memory client to use for storage queries
 * @param accessList - The access list containing addresses and slots to query
 * @returns Storage values for all addresses and slots in the access list
 */
export const storageSnapshot = async (
  client: MemoryClient,
  accessList: AccessList,
): Promise<Record<Address, StorageSnapshot>> => {
  const results = await Promise.all(
    Object.entries(accessList).map(async ([contractAddress, slots]) => {
      const slotValues = await Promise.all(
        Array.from(slots).map((slot) => client.getStorageAt({ address: contractAddress as Address, slot })),
      );

      return [
        contractAddress as Address,
        Object.fromEntries(Array.from(slots).map((slot, index) => [slot, { value: slotValues[index] }])),
      ] as [Address, StorageSnapshot];
    }),
  );

  return Object.fromEntries(results);
};

/**
 * Analyzes storage by comparing pre and post transaction states to identify accesses.
 *
 * @param preTx - Storage values before transaction execution
 * @param postTx - Storage values after transaction execution
 * @returns Unified storage accesses with writes having both current and next fields, and reads having just a current
 *   field
 */
export const storageDiff = (preTx: StorageSnapshot, postTx: StorageSnapshot): StorageDiff => {
  return Object.entries(postTx).reduce((accesses, [slot, { value: post }]) => {
    const pre = preTx[slot as Hex].value;
    if (!pre) throw new Error("Storage pre tx not found");

    // If values are different, it's a write (with both current and next)
    // Otherwise, it's a read (with only current)
    accesses[slot as Hex] = pre !== post ? { current: pre, next: post } : { current: pre };

    return accesses;
  }, {} as StorageDiff);
};

/**
 * Fetches the account state for a list of addresses.
 *
 * @param client - The memory client to use for account queries
 * @param accounts - List of account addresses to query
 * @returns Full account state for each address
 */
export const intrinsicSnapshot = async (
  client: MemoryClient,
  accounts: Array<Address>,
): Promise<Record<Address, IntrinsicsSnapshot>> => {
  const results = await Promise.all(
    accounts.map(async (address) => {
      try {
        const state = await client.tevmGetAccount({ address, returnStorage: true });

        return [
          address,
          {
            balance: { value: state.balance },
            nonce: { value: state.nonce },
            deployedBytecode: { value: state.deployedBytecode },
            codeHash: { value: state.codeHash },
            storageRoot: { value: state.storageRoot },
          },
        ] as [Address, IntrinsicsSnapshot];
      } catch (err) {
        debug(`Error fetching account state for ${address}, or account not initialized:`, err);
        return [
          address,
          {
            balance: { value: 0n },
            nonce: { value: 0n },
            deployedBytecode: { value: "0x" },
            codeHash: { value: EMPTY_CODE_HASH },
            storageRoot: { value: EMPTY_STORAGE_ROOT },
          },
        ] as [Address, IntrinsicsSnapshot];
      }
    }),
  );

  return Object.fromEntries(results);
};

/**
 * Compares account states before and after transaction execution.
 *
 * @param preTx - Account state before transaction
 * @param postTx - Account state after transaction
 * @returns Account field changes during transaction
 */
export const intrinsicDiff = (preTx: IntrinsicsSnapshot, postTx: IntrinsicsSnapshot): IntrinsicsDiff => {
  return (Object.keys(postTx) as Array<keyof IntrinsicsSnapshot>).reduce((result, field) => {
    const preField = preTx[field];
    if (!preField) throw new Error(`Account field ${field} not found in pre-transaction state`);

    const current = preField.value;
    const next = postTx[field].value;

    // If values are different, include the next value
    (result[field] as any) = current !== next ? { current, next } : { current };

    return result;
  }, {} as IntrinsicsDiff);
};
