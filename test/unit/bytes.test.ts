import { describe, expect, it } from "vitest";

import { ACCOUNTS, CONTRACTS } from "@test/constants.js";
import { getClient } from "@test/utils.js";
import { traceState } from "@/index.js";

const { Bytes } = CONTRACTS;
const { caller } = ACCOUNTS;

/**
 * Bytes and Strings tests
 *
 * This test suite verifies storage access patterns for:
 *
 * 1. Short strings/bytes (<= 31 bytes) stored in a single slot.
 * 2. Long strings/bytes (> 31 bytes) stored across multiple slots (length slot + data slots).
 * 3. Updates between short and long values.
 * 4. Reading and clearing string/bytes values.
 */
describe("Bytes and Strings", () => {
  describe("Short Values (<= 31 bytes)", () => {
    it("should trace setting a short string", async () => {
      const client = getClient();

      expect(
        await traceState({
          ...Bytes.write.setString("short string"),
          client,
          from: caller.toString(),
        }),
      ).toMatchSnapshot();
    });

    it("should trace getting a short string", async () => {
      const client = getClient();

      // Set value first
      await client.tevmContract({
        ...Bytes.write.setString("short string"),
        from: caller.toString(),
        addToBlockchain: true,
      });

      expect(
        await traceState({
          client,
          from: caller.toString(),
          to: Bytes.address,
          abi: Bytes.abi,
          functionName: "getString",
          args: [],
        }),
      ).toMatchSnapshot();
    });

    it("should trace setting short bytes", async () => {
      const client = getClient();

      expect(
        await traceState({
          ...Bytes.write.setBytes("0x0102030405"),
          client,
          from: caller.toString(),
        }),
      ).toMatchSnapshot();
    });

    it("should trace getting short bytes", async () => {
      const client = getClient();

      // Set value first
      await client.tevmContract({
        ...Bytes.write.setBytes("0x0102030405"),
        from: caller.toString(),
        addToBlockchain: true,
      });

      expect(
        await traceState({
          client,
          from: caller.toString(),
          to: Bytes.address,
          abi: Bytes.abi,
          functionName: "getBytes",
          args: [],
        }),
      ).toMatchSnapshot();
    });

    it("should trace clearing a short string", async () => {
      const client = getClient();

      // Set value first
      await client.tevmContract({
        ...Bytes.write.setString("short string"),
        from: caller.toString(),
        addToBlockchain: true,
      });

      expect(
        await traceState({
          client,
          from: caller.toString(),
          to: Bytes.address,
          abi: Bytes.abi,
          functionName: "clearString",
          args: [],
        }),
      ).toMatchSnapshot();
    });
  });

  describe("Long Values (> 31 bytes)", () => {
    it("should trace setting a long string", async () => {
      const client = getClient();

      expect(
        await traceState({
          ...Bytes.write.setString("a very long string".repeat(10)),
          client,
          from: caller.toString(),
        }),
      ).toMatchSnapshot();
    });

    it("should trace getting a long string", async () => {
      const client = getClient();

      // Set value first
      await client.tevmContract({
        ...Bytes.write.setString("a very long string".repeat(10)),
        from: caller.toString(),
        addToBlockchain: true,
      });

      expect(
        await traceState({
          client,
          from: caller.toString(),
          to: Bytes.address,
          abi: Bytes.abi,
          functionName: "getString",
          args: [],
        }),
      ).toMatchSnapshot();
    });

    it("should trace setting long bytes", async () => {
      const client = getClient();

      expect(
        await traceState({
          ...Bytes.write.setBytes(`0x${"abcd".repeat(30)}`),
          client,
          from: caller.toString(),
        }),
      ).toMatchSnapshot();
    });

    it("should trace getting long bytes", async () => {
      const client = getClient();

      // Set value first
      await client.tevmContract({
        ...Bytes.write.setBytes(`0x${"abcd".repeat(30)}`),
        from: caller.toString(),
        addToBlockchain: true,
      });

      expect(
        await traceState({
          client,
          from: caller.toString(),
          to: Bytes.address,
          abi: Bytes.abi,
          functionName: "getBytes",
          args: [],
        }),
      ).toMatchSnapshot();
    });

    it("should trace clearing a long string", async () => {
      const client = getClient();

      // Set value first
      await client.tevmContract({
        ...Bytes.write.setString("a very long string".repeat(10)),
        from: caller.toString(),
        addToBlockchain: true,
      });

      expect(
        await traceState({
          client,
          from: caller.toString(),
          to: Bytes.address,
          abi: Bytes.abi,
          functionName: "clearString",
          args: [],
        }),
      ).toMatchSnapshot();
    });
  });

  describe("Transitions", () => {
    it("should trace updating short string to long string", async () => {
      const client = getClient();

      // Set short value first
      await client.tevmContract({
        ...Bytes.write.setString("short string"),
        from: caller.toString(),
        addToBlockchain: true,
      });

      expect(
        await traceState({
          ...Bytes.write.setString("a very long string".repeat(10)),
          client,
          from: caller.toString(),
        }),
      ).toMatchSnapshot();
    });

    it("should trace updating long string to short string", async () => {
      const client = getClient();

      // Set long value first
      await client.tevmContract({
        ...Bytes.write.setString("a very long string".repeat(10)),
        from: caller.toString(),
        addToBlockchain: true,
      });

      expect(
        await traceState({
          ...Bytes.write.setString("short string"),
          client,
          from: caller.toString(),
        }),
      ).toMatchSnapshot();
    });

    it("should trace updating long string to another long string (different length)", async () => {
      const client = getClient();

      // Set long value first
      await client.tevmContract({
        ...Bytes.write.setString("a very long string".repeat(10)),
        from: caller.toString(),
        addToBlockchain: true,
      });

      expect(
        await traceState({
          ...Bytes.write.setString("an even longer string than before".repeat(10)),
          client,
          from: caller.toString(),
        }),
      ).toMatchSnapshot();
    });
  });
});
