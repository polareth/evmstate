import { Address, createMemoryClient, Hex, http, MemoryClient } from "tevm";
import { Common } from "tevm/common";
import { ForkOptions } from "tevm/state";

export type GetAccessListOptions = {
  from: Address;
  to?: Address;
  data: Hex;

  // Need to provide either client or fork or rpcUrl
  client?: MemoryClient;
  fork?: ForkOptions;
  rpcUrl?: string;
  // Makes it faster cause no need to fetch chain info
  common?: Common;
};

export type GetAccessListResult = Array<{
  address: Address;
  // TODO: values should probably be decoded using the abi, but we will modify to label anyway
  writes: Array<{ slot: Hex; current: Hex; next: Hex }>;
  reads: Array<{ slot: Hex; current: Hex }>;
}>;

export const getAccessList = async (options: GetAccessListOptions): Promise<GetAccessListResult> => {
  const { from, to, data, client: _client, fork, rpcUrl, common } = options;
  if (!_client && !fork && !rpcUrl)
    throw new Error("You need to provide either rpcUrl or fork options that include a transport");

  // Create the tevm client
  const client =
    _client ??
    createMemoryClient({
      common,
      fork: fork ?? {
        transport: http(rpcUrl),
      },
    });

  const callResult = await client.tevmCall({
    from,
    to,
    data,
    blockTag: "latest",
    skipBalance: true,
    createAccessList: true,
    createTransaction: true,
  });

  if (!callResult.accessList) return [];

  // Get the storage values for all accessed slots before the transaction is mined
  const storagePreTx = await getStorageForAccessList(client, callResult.accessList);
  await client.tevmMine({ blockCount: 1 });
  // Get values after the transaction has been included
  const storagePostTx = await getStorageForAccessList(client, callResult.accessList);

  return getAccessListsDiff(storagePreTx, storagePostTx);
};

type StorageForAccessList = Array<{
  address: Address;
  storage: Array<{ slot: Hex; value: Hex | undefined }>;
}>;
const getStorageForAccessList = async (
  client: MemoryClient,
  accessList: Record<Address, Set<Hex>>,
): Promise<StorageForAccessList> => {
  return await Promise.all(
    Object.entries(accessList).map(async ([contractAddress, slots]) => {
      const slotValues = await Promise.all(
        Array.from(slots).map((slot) => client.getStorageAt({ address: contractAddress as Address, slot })),
      );

      return {
        address: contractAddress as Address,
        storage: Array.from(slots).map((slot) => ({ slot, value: slotValues[slotValues.length - 1] })),
      };
    }),
  );
};

const getAccessListsDiff = (
  storagePreTx: StorageForAccessList,
  storagePostTx: StorageForAccessList,
): GetAccessListResult => {
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
      // TODO: same here, no mercy
      .filter((item): item is { slot: Hex; current: Hex } => item.current !== undefined);

    return {
      address,
      writes,
      reads,
    };
  });
};
