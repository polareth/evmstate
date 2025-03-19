import { Address, MemoryClient } from "tevm";
import { createSolc, releases, SolcContractOutput, SolcSettings } from "tevm/bundler/solc";
import { randomBytes } from "tevm/utils";
import { autoload, loaders } from "@shazow/whatsabi";

import { TraceStorageAccessOptions } from "@/lib/types";

export type GetContractsOptions = {
  client: MemoryClient;
  addresses: Array<Address>;
  explorers?: TraceStorageAccessOptions["explorers"];
};

export type GetContractsResult = Record<
  Address,
  {
    metadata: {
      name?: string;
      evmVersion?: string;
      compilerVersion?: string;
    };
    sources?: Array<{ path?: string; content: string }>;
  }
>;

// WARNING: the following types are experimental (?) and subject to change in non breaking releases
// Define the base structure for all storage layout types
export interface StorageLayoutTypeBase {
  encoding: string;
  label: string;
  numberOfBytes: string;
}

// Define specific storage layout types with their unique properties
export interface StorageLayoutInplaceType extends StorageLayoutTypeBase {
  encoding: "inplace";
}

export interface StorageLayoutBytesType extends StorageLayoutTypeBase {
  encoding: "bytes";
}

export interface StorageLayoutMappingType extends StorageLayoutTypeBase {
  encoding: "mapping";
  key: `t_${string}`;
  value: `t_${string}`;
}

export interface StorageLayoutDynamicArrayType extends StorageLayoutTypeBase {
  encoding: "dynamic_array";
  base: `t_${string}`;
}

export interface StorageLayoutStructType extends StorageLayoutInplaceType {
  members: Array<{
    label: string;
    slot: string;
    offset: number;
    type: `t_${string}`;
  }>;
}

// Union of all possible storage layout types
export type StorageLayoutType =
  | StorageLayoutInplaceType
  | StorageLayoutBytesType
  | StorageLayoutMappingType
  | StorageLayoutDynamicArrayType
  | StorageLayoutStructType;

// Type-safe record of storage layout types
export type StorageLayoutTypes = Record<`t_${string}`, StorageLayoutType>;

// Type-safe storage layout item that references a type in StorageLayoutTypes
export type StorageLayoutItem<T extends StorageLayoutTypes = StorageLayoutTypes> = {
  astId: number;
  contract: string;
  label: string;
  offset: number;
  slot: string;
  type: keyof T;
};

// Type-safe storage layout output
export type StorageLayoutOutput<T extends StorageLayoutTypes = StorageLayoutTypes> = {
  storage: Array<StorageLayoutItem<T>>;
  types: T;
};

const ignoredSourcePaths = ["metadata.json", "creator-tx-hash.txt", "immutable-references"];

export const getContracts = async ({
  client,
  addresses,
  explorers,
}: GetContractsOptions): Promise<GetContractsResult> => {
  const abiLoader = new loaders.MultiABILoader([
    new loaders.SourcifyABILoader({ chainId: client.chain?.id }),
    new loaders.EtherscanABILoader({
      baseURL: explorers?.etherscan?.baseUrl ?? "https://api.etherscan.io/api",
      apiKey: explorers?.etherscan?.apiKey,
    }),
    new loaders.BlockscoutABILoader({
      baseURL: explorers?.blockscout?.baseUrl ?? "https://eth.blockscout.com/api",
      apiKey: explorers?.blockscout?.apiKey,
    }),
  ]);

  try {
    // Get the contract sources and ABI
    const responses = await Promise.all(
      addresses.map((address) =>
        autoload(address, {
          provider: client,
          abiLoader,
          followProxies: true,
          loadContractResult: true,
        }),
      ),
    );

    const sources = await Promise.all(responses.map((r) => r.contractResult?.getSources?.()));

    return responses.reduce((acc, r, index) => {
      acc[r.address as Address] = {
        metadata: {
          name: r.contractResult?.name ?? undefined,
          evmVersion: r.contractResult?.evmVersion,
          compilerVersion: r.contractResult?.compilerVersion,
        },
        sources: sources[index]?.filter(({ path }) => !ignoredSourcePaths.some((p) => path?.includes(p))),
      };
      return acc;
    }, {} as GetContractsResult);
  } catch (err) {
    console.error(err);
    return {};
  }
};

// -> { slot: { name: string, type: Type } }
// TODO: fee this to claude: https://docs.soliditylang.org/en/latest/internals/layout_in_storage.html
// to figure out how to retrieve storage slots for mappings & dynamic arrays
export const getStorageLayout = async ({
  address,
  metadata,
  sources,
}: GetContractsResult[Address] & { address: Address }) => {
  const { compilerVersion, evmVersion } = metadata;
  if (!compilerVersion) throw new Error("Could not get compiler version");
  if (!evmVersion) throw new Error("Could not get evm version");
  if (!sources) throw new Error("Could not get contract sources");

  const solc = await createSolc(getSolcVersion(compilerVersion));
  const output = solc.compile({
    language: "Solidity",
    settings: {
      evmVersion: metadata.evmVersion as SolcSettings["evmVersion"],
      outputSelection: {
        "*": {
          "*": ["storageLayout"],
        },
      },
    },
    sources: Object.fromEntries(
      sources.map(({ path, content }) =>
        // TODO: actual random uuid or whatever
        [path ?? randomBytes(8).toString(), { content }],
      ),
    ),
  });

  // ? How can we compile multiple contracts, and correctly get the storage layout cause there is inheritance order
  // ? At least we get the name from whatsabi so we know the main contract; maybe compiling it is enough and we just
  // ? provide ALL the source codes?

  // ? If some storage item modified correspond to a mapping value modification, we'll need to have retrieved this storage slot
  // ? by computing correct combinaisons of keys to encode to the right hash
  // ? e.g. if we have mapping(address => uint256) we'll find out the label only if we thought about encoding the right address `x`
  // ? to produce the modified slot with keccak256(abi.encode(x, mappingSlot))

  const layouts = Object.values(output.contracts)
    .flatMap((layouts) => Object.values(layouts))
    .map((l) => l.storageLayout) as Array<StorageLayoutOutput>;

  // TODO: most probably wrong as we might be aggregating multiple contracts storage layouts
  // Do we need to filter to get only our contract? is this enough?
  // Aggregate all storage items and types from different layouts
  const aggregatedTypes: StorageLayoutTypes = layouts.reduce((acc, layout) => {
    if (!layout?.types) return acc;
    return { ...acc, ...layout.types };
  }, {} as StorageLayoutTypes);

  // Now that we have all types, we can properly type the storage items
  const aggregatedStorage: Array<StorageLayoutItem<typeof aggregatedTypes>> = layouts.reduce(
    (acc, layout) => {
      if (!layout?.storage) return acc;
      return [...acc, ...layout.storage];
    },
    [] as Array<StorageLayoutItem<typeof aggregatedTypes>>,
  );

  // Create the final storage layout with properly typed relationships
  const finalLayout: StorageLayoutOutput<typeof aggregatedTypes> = {
    storage: aggregatedStorage,
    types: aggregatedTypes,
  };

  console.log(JSON.stringify(finalLayout, null, 2));
};

const getSolcVersion = (_version: string) => {
  const release = Object.entries(releases).find(([_, v]) => v === `v${_version}`);
  if (!release) throw new Error(`Solc version ${_version} not found`);
  return release[0] as keyof typeof releases;
};
