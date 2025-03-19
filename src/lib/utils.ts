import { Address } from "tevm";

/**
 * Creates a unified list of addresses from storage and account state objects.
 */
export const getUniqueAddresses = (
  storageStates: Record<Address, unknown>,
  accountStates: Record<Address, unknown>,
): Address[] => {
  // Create a set of all unique addresses from both objects
  const addressSet = new Set<Address>([
    ...Object.keys(storageStates) as Address[],
    ...Object.keys(accountStates) as Address[],
  ]);

  // Convert to array and sort for consistent output order
  return Array.from(addressSet).sort();
};
