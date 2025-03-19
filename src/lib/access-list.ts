import { Address, GetAccountResult, Hex, MemoryClient } from "tevm";

/* --------------------------- STORAGE SLOT TYPES --------------------------- */
/**
 * Type representing the storage at a defined slot at a specific point in time.
 */
export type StorageSnapshot = {
  /** Storage slot location */
  [slot: Hex]: {
    /** Current storage value (may be undefined) */
    value: Hex | undefined;
  };
};

/**
 * Type representing a list of storage reads without modification.
 */
export type StorageReads = {
  /** Storage slot location */
  [slot: Hex]: {
    /** Current storage value */
    current: Hex;
  };
};

/**
 * Type representing a list of storage writes with modification.
 */
export type StorageWrites = {
  /** Storage slot location */
  [slot: Hex]: {
    /** Current storage value before transaction */
    current: Hex;
    /** New storage value after transaction */
    next: Hex;
  };
};

/* -------------------------- ACCOUNT STORAGE TYPES ------------------------- */
/**
 * State fields at the intrinsic level of an account.
 *
 * @internal
 */
type Intrinsics = Pick<GetAccountResult, "balance" | "codeHash" | "deployedBytecode" | "nonce" | "storageRoot">;

/**
 * Type representing the intrinsic state of an account at a specific point in time.
 */
export type IntrinsicsSnapshot = {
  /** Account field identifier */
  [K in keyof Intrinsics]: {
    /** Current value of the field */
    value: Intrinsics[K];
  };
};

/**
 * Type representing the difference in intrinsic account state during transaction.
 */
export type IntrinsicsDiff = {
  /** Account field identifier */
  [K in keyof Intrinsics]: {
    /** Value before transaction */
    current: Intrinsics[K];
    /** Value after transaction (undefined if not modified) */
    next?: Intrinsics[K];
  };
};

/* -------------------------- AGGREGATED STATE TYPES -------------------------- */
/**
 * Complete snapshot of an account's storage and account state at a point in time.
 *
 * This can represent either a contract or an EOA.
 */
export type AccountSnapshot<EOA extends boolean = false> = {
  /** Storage slots state (only applicable for contracts) */
  storage: EOA extends false ? StorageSnapshot : never;
  /** Account fields state */
  intrinsic: IntrinsicsSnapshot;
};

/**
 * Complete difference between pre-transaction and post-transaction states for an address.
 *
 * This can represent either a contract or an EOA (Externally Owned Account).
 */
export type AccountDiff<EOA extends boolean = false> = {
  /** Storage slots that were read but not modified during transaction (only applicable for contracts) */
  reads: EOA extends false ? StorageReads : never;
  /** Storage slots that were modified during transaction (only applicable for contracts) */
  writes: EOA extends false ? StorageWrites : never;
  /** Account field changes during transaction */
  intrinsic: IntrinsicsDiff;
};

/**
 * Internal type representing the access list format from tevm.
 */
type AccessList = Record<Address, Set<Hex>>;

/* -------------------------------- FUNCTIONS ------------------------------- */
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
 * Analyzes storage by comparing pre and post transaction states to identify reads and writes.
 *
 * @param preTx - Storage values before transaction execution
 * @param postTx - Storage values after transaction execution
 * @returns Detailed analysis of storage reads and writes
 */
export const storageDiff = (preTx: StorageSnapshot, postTx: StorageSnapshot): Omit<AccountDiff, "intrinsic"> => {
  const writesArray = Object.entries(postTx)
    .map(([slot, { value: next }]) => {
      const preSlot = preTx[slot as Hex];
      if (!preSlot) throw new Error("Storage pre tx not found"); // TODO: we're unforgiving here, will tweak during testing
      const current = preSlot.value;

      // Only include if values are different
      return current !== next ? { slot: slot as Hex, current, next } : null;
    })
    .filter((item): item is { slot: Hex; current: Hex; next: Hex } => item !== null);

  // Convert writes array to object with slot as key
  const writes: StorageWrites = Object.fromEntries(
    writesArray.map(({ slot, current, next }) => [slot, { current, next }]),
  );

  // Get all slots that were read but not written to
  const reads: StorageReads = Object.fromEntries(
    (
      Object.entries(postTx)
        .filter(([slot]) => !writes[slot as Hex])
        .map(([slot, { value }]) => [slot, { current: value }]) as Array<[Hex, { current: Hex }]>
    ).filter(([_, { current }]) => current !== undefined),
  );

  return {
    writes,
    reads,
  };
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
  let result = {} as IntrinsicsDiff;

  // Process each field in the intrinsic account state
  for (const field of Object.keys(postTx) as Array<keyof IntrinsicsSnapshot>) {
    const preField = preTx[field];
    if (!preField) throw new Error(`Account field ${field} not found in pre-transaction state`);

    const current = preField.value;
    const next = postTx[field].value;

    // If values are different, include the next value
    if (current !== next) {
      // TODO: hate using any here but now sure how to do otherwise for these nested properties
      (result[field] as any) = { current: current, next: next };
    } else {
      (result[field] as any) = { current: current };
    }
  }

  return result;
};

/**
 * Creates a complete address state diff by combining slot and account changes.
 *
 * @param slotsDiff - Changes to address storage slots (for contracts)
 * @param accountDiff - Changes to account fields
 * @returns Complete address state diff
 */
export const createAccountDiff = (
  slotsDiff: Omit<AccountDiff, "intrinsic">,
  accountDiff: IntrinsicsDiff,
): AccountDiff => {
  return {
    ...slotsDiff,
    intrinsic: accountDiff,
  };
};
