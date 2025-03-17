import { Address, Hex } from "tevm";

export const getAccessedSlots = ({
  address,
  accessList,
}: {
  address: Address;
  accessList: Record<Hex, Set<Hex>> | undefined;
}): Array<Hex> => {
  return Array.from(accessList?.[address] ?? new Set());
};
