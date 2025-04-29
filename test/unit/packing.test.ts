import { encodeFunctionData } from "tevm";
import { assert, describe, expect, it } from "vitest";

import { ACCOUNTS, CONTRACTS } from "@test/constants";
import { getClient } from "@test/utils";
import { traceState } from "@/index";

const { StoragePacking } = CONTRACTS;
const { caller } = ACCOUNTS;

/**
 * Basic storage access tests with storage packing
 *
 * This test suite verifies:
 *
 * 1. Basic storage access tracing for both packed and unpacked variables
 * 2. Detection of storage reads and writes with proper labeling and typing
 * 3. Handling of different data types (uint8/16/32/64/256, bool, bytes32, address)
 * 4. Correct tracking of packed storage variables in a single slot
 * 5. Individual updates to variables within packed slots
 * 6. Mixed operations across packed and unpacked slots
 * 7. Account state changes tracking (nonce, balance)
 * 8. Large numeric values handling
 * 9. Tracer class
 */

describe("Basic slots access and packing", () => {
  describe("traceState with contract call", () => {
    it("should handle packed storage variables correctly", async () => {
      const client = getClient();

      // Set packed values in a single storage slot (uint8, uint8, bool, address)
      expect(
        await traceState({
          ...StoragePacking.write.setSmallValues(42, 123, true, caller.toString()),
          client,
          from: caller.toString(),
        }),
      ).toMatchFileSnapshot("./__snapshots__/setSmallValues.shared.snap");
    });

    it("should handle individual updates to packed variables", async () => {
      const client = getClient();

      // Now update just one variable in the packed slot
      expect(
        await traceState({
          ...StoragePacking.write.setMediumValue1(999),
          client,
          from: caller.toString(),
        }),
      ).toMatchSnapshot();
    });

    it("should track updates across multiple slots including packed and non-packed", async () => {
      const client = getClient();

      // Update values across multiple slots, including both packed and non-packed
      // We expect at least 3 slots to be accessed:
      // - Slot 0: smallValue1, smallValue2, (packed) (flag & someAddress are not modified)
      // - Slot 3: mediumValue1, mediumValue2, mediumValue3 (packed) (mediumValue3 is not modified)
      // - Slot 1: largeValue1 (not packed) (written last)
      expect(
        await traceState({
          ...StoragePacking.write.updateAllValues(10, 20, 1000, 2000, 12345n),
          client,
          from: caller.toString(),
        }),
      ).toMatchSnapshot();
    });

    it("should handle large numeric values correctly", async () => {
      const client = getClient();

      // Set a large value in a non-packed slot
      expect(
        await traceState({
          ...StoragePacking.write.setLargeValue1(123456789012345678901234567890n),
          client,
          from: caller.toString(),
        }),
      ).toMatchSnapshot();
    });

    it("should handle bytes32 data correctly", async () => {
      const client = getClient();

      // Set the bytes32 data
      expect(
        await traceState({
          ...StoragePacking.write.setData("0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"),
          client,
          from: caller.toString(),
        }),
      ).toMatchSnapshot();
    });

    it("should capture storage reads when getting values", async () => {
      const client = getClient();

      // Read the value and trace the storage access
      expect(
        await traceState({
          client,
          from: caller.toString(),
          to: StoragePacking.address,
          abi: StoragePacking.abi,
          functionName: "getLargeValue1",
          args: [],
        }),
      ).toMatchSnapshot();
    });
  });

  describe("traceState with transaction calldata", () => {
    it("should work similarily to traceState", async () => {
      const client = getClient();

      expect(
        await traceState({
          client,
          from: caller.toString(),
          to: StoragePacking.address,
          data: encodeFunctionData(StoragePacking.write.setSmallValues(42, 123, true, caller.toString())),
        }),
      ).toMatchFileSnapshot("./__snapshots__/setSmallValues.shared.snap");
    });
  });
});
