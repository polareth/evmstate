import { EthjsAddress } from "tevm/utils";
import type { ExtractAbiFunctions } from "abitype";

import * as LAYOUTS from "@test/codegen/layouts/index.js";
import * as CONTRACTS from "@test/contracts/index.js";

export const contract = CONTRACTS["Playground"].withAddress(
  EthjsAddress.fromString("0x987C2AF139EAEaBdF8D6d3d1723C1883bEa1f2AF").toString(),
);
export const layout = LAYOUTS["Playground"];
export const callerAddress = EthjsAddress.fromString("0xCa11e40000000000000000000000000000000000");
export const localStorageKey = "EVMSTATE_PLAYGROUND_STATE";

export const functionDescriptions: Record<ExtractAbiFunctions<typeof contract.abi, "nonpayable">["name"], string> = {
  addValue: "Adds to a dynamic array",
  addUser: "Adds a user struct to a mapping and array",
  toggleUserActive: "Toggles a boolean in a struct within a mapping",
  setBalance: "Updates a simple mapping value",
  setAllowance: "Updates a nested mapping value",
  addTransaction: "Adds to a dynamic array within a mapping",
  updateBasicValues: "Updates primitive types (uint256, bool)",
  updatePackedValues: "Updates packed storage variables (uint8, uint16, uint32, bool)",
  setStringAndBytes: "Updates string and bytes storage",
  setFixedValue: "Updates a fixed-size array element",
};
