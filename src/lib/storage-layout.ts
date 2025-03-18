import { Address, MemoryClient } from "tevm";
import { whatsabi } from "@shazow/whatsabi";

export type GetStorageLayoutOptions = {
  address: Address;
  client: MemoryClient;
};

export const getStorageLayout = ({ address, client }: GetStorageLayoutOptions) => {};
