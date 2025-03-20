import { readFileSync } from "fs";
import { join } from "path";
import { Address, createMemoryClient } from "tevm";
import { EthjsAccount, parseEther } from "tevm/utils";
import { beforeAll, vi } from "vitest";

import { ACCOUNTS, CONTRACTS } from "@test/constants";
import * as storageLayout from "@/lib/storage-layout";

beforeAll(async () => {
  const client = createMemoryClient();
  // @ts-expect-error type
  globalThis.client = client;

  // Initialize accounts
  const vm = await client.transport.tevm.getVm();
  await Promise.all(
    Object.values(ACCOUNTS).map((account) =>
      vm.stateManager.putAccount(
        account,
        EthjsAccount.fromAccountData({
          balance: parseEther("10"),
          nonce: 0n,
        }),
      ),
    ),
  );

  // Initialize contracts
  await Promise.all(Object.values(CONTRACTS).map((contract) => client.tevmSetAccount(contract)));

  // Setup mocks for contract-related functions
  if (process.env.TEST_ENV !== "staging") setupContractsMock();
});

/**
 * Create a mock for the getContracts function that returns contract information
 * directly from our test contracts rather than fetching from external APIs.
 */
const setupContractsMock = () => {
  // Mock the getContracts function
  vi.spyOn(storageLayout, "getContracts").mockImplementation(async ({ addresses }) => {
    return Object.fromEntries(
      addresses.map((address) => {
        const contract = Object.values(CONTRACTS).find((contract) => contract.address === address);
        if (!contract) {
          return [
            address,
            {
              metadata: {},
              sources: [],
            },
          ];
        }

        return [
          address,
          {
            metadata: {
              name: contract.name,
              evmVersion: "paris",
              compilerVersion: "0.8.23+commit.f704f362",
            },
            sources: [{ path: contract.name, content: getContractCode(contract.name ?? "") }],
          } as const satisfies storageLayout.GetContractsResult[Address],
        ];
      }),
    );
  });
};

const getContractCode = (name: string) => {
  const indexPath = join(__dirname, "contracts/index.ts");
  let contractCode = "";

  try {
    const indexContent = readFileSync(indexPath, "utf8");
    // Find the export line for this contract
    const regex = new RegExp(`export\\s+\\{\\s*${name}(?:\\s*,\\s*[\\w]+)*\\s*\\}\\s+from\\s+["'](.+?)["']`);
    const match = indexContent.match(regex);

    if (match && match[1]) {
      // Construct the full path to the contract file
      const contractPath = join(__dirname, "contracts", match[1]);
      contractCode = readFileSync(contractPath, "utf8");
    }
  } catch (error) {
    console.warn(`Could not find contract file for ${name}:`, error);
  }

  return contractCode;
};
