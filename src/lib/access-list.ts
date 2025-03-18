import { Address, Hex, MemoryClient } from "tevm";

/**
 * Detailed information about storage reads and writes during transaction execution.
 */
export type StorageStatesDiff = Array<{
  /** Contract address */
  address: Address;
  /** Storage slots that were modified during transaction execution */
  writes: Array<{
    /** Storage slot location */
    slot: Hex;
    /** Value before transaction */
    current: Hex;
    /** Value after transaction */
    next: Hex;
  }>;
  /** Storage slots that were read but not modified during transaction execution */
  reads: Array<{
    /** Storage slot location */
    slot: Hex;
    /** Current value */
    current: Hex;
  }>;
}>;

/**
 * Internal type representing the access list format from tevm.
 */
type AccessList = Record<Address, Set<Hex>>;

/**
 * Internal type representing storage values at a specific point in time.
 */
type StorageState = Array<{
  /** Contract address */
  address: Address;
  /** Storage slot values */
  storage: Array<{
    /** Storage slot location */
    slot: Hex;
    /** Current storage value (may be undefined) */
    value: Hex | undefined;
  }>;
}>;

/**
 * Fetches storage values for all slots in an access list.
 *
 * @param client - The memory client to use for storage queries
 * @param accessList - The access list containing addresses and slots to query
 * @returns Storage values for all addresses and slots in the access list
 */
export const fetchStorageValues = async (client: MemoryClient, accessList: AccessList): Promise<StorageState> => {
  return await Promise.all(
    Object.entries(accessList).map(async ([contractAddress, slots]) => {
      const slotValues = await Promise.all(
        Array.from(slots).map((slot) => client.getStorageAt({ address: contractAddress as Address, slot })),
      );

      return {
        address: contractAddress as Address,
        storage: Array.from(slots).map((slot, index) => ({ slot, value: slotValues[index] })),
      };
    }),
  );
};

/**
 * Analyzes storage by comparing pre and post transaction states to identify reads and writes.
 *
 * @param storagePreTx - Storage values before transaction execution
 * @param storagePostTx - Storage values after transaction execution
 * @returns Detailed analysis of storage reads and writes
 */
export const compareStorageStates = (storagePreTx: StorageState, storagePostTx: StorageState): StorageStatesDiff => {
  return storagePostTx.map(({ address, storage: post }) => {
    const pre = storagePreTx.find(({ address: addressPreTx }) => addressPreTx === address);
    if (!pre) throw new Error("Storage pre tx not found");

    const writes = post
      .map(({ slot, value: next }) => {
        const preSlot = pre.storage.find(({ slot: slotPreTx }) => slotPreTx === slot);
        if (!preSlot) throw new Error("Storage pre tx not found"); // TODO: we're unforgiving here, will tweak during testing
        const current = preSlot.value;

        // Only include if values are different
        return current !== next ? { slot, current, next } : null;
      })
      .filter((item): item is { slot: Hex; current: Hex; next: Hex } => item !== null);

    const reads = pre.storage
      .filter(({ slot }) => {
        // A slot is read-only if it doesn't appear in the writes array
        return !writes.some((write) => write.slot === slot);
      })
      .map(({ slot, value }) => ({ slot, current: value }))
      // TODO: no mercy here as well
      .filter((item): item is { slot: Hex; current: Hex } => item.current !== undefined);

    return {
      address,
      writes,
      reads,
    };
  });
};
