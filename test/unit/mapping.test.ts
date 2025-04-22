import { getAddress, toHex } from "tevm";
import { assert, describe, expect, it } from "vitest";

import { ACCOUNTS, CONTRACTS, LAYOUTS } from "@test/constants";
import { expectedStorage, getArraySlotHex, getClient, getMappingSlotHex, getSlotAtOffsetHex } from "@test/utils";
import { traceStorageAccess } from "@/index";
import { PathSegmentKind } from "@/lib/explore/types";

const { Mappings } = CONTRACTS;
const { caller, recipient } = ACCOUNTS;

/**
 * Mappings tests
 *
 * This test suite verifies:
 *
 * 1. Simple and nested mapping slot access
 * 2. Mapping with struct values
 * 3. Complex mapping operations with storage updates
 * 4. Fixed and dynamic array storage access patterns
 * 5. Array length slot access and element storage
 * 6. Struct arrays with complex data storage layout
 * 7. Nested array storage patterns
 */
describe("Mappings", () => {
  it("should trace simple mapping slot access", async () => {
    const client = getClient();
    const user = recipient.toString();
    const amount = 1000n;

    // Set a value in the balances mapping
    const writeTrace = await traceStorageAccess({
      client,
      from: caller.toString(),
      to: Mappings.address,
      abi: Mappings.abi,
      functionName: "setBalance",
      args: [user, amount],
    });

    // Verify the write operation was captured
    expect(writeTrace[Mappings.address].storage).toEqual(
      expectedStorage(LAYOUTS.Mappings, {
        balances: {
          name: "balances",
          type: "mapping(address => uint256)",
          kind: "mapping",
          trace: [
            {
              current: { hex: toHex(0, { size: 1 }), decoded: 0n },
              next: { hex: toHex(amount, { size: 32 }), decoded: amount },
              modified: true,
              slots: [getMappingSlotHex(0, user)],
              path: [
                {
                  kind: PathSegmentKind.MappingKey,
                  key: user,
                  keyType: "address",
                },
              ],
              fullExpression: `balances[${user}]`,
            },
          ],
        },
      }),
    );

    // Read the value and check if the same slot is accessed
    const readTrace = await traceStorageAccess({
      client,
      from: caller.toString(),
      to: Mappings.address,
      abi: Mappings.abi,
      functionName: "getBalance",
      args: [user],
    });

    expect(readTrace[Mappings.address].storage).toEqual(
      expectedStorage(LAYOUTS.Mappings, {
        balances: {
          name: "balances",
          type: "mapping(address => uint256)",
          kind: "mapping",
          trace: [
            {
              current: { hex: toHex(amount, { size: 32 }), decoded: amount },
              modified: false,
              slots: [getMappingSlotHex(0, user)],
              path: [
                {
                  kind: PathSegmentKind.MappingKey,
                  key: user,
                  keyType: "address",
                },
              ],
              fullExpression: `balances[${user}]`,
            },
          ],
        },
      }),
    );
  });

  it("should trace nested mapping slot access", async () => {
    const client = getClient();
    const owner = caller.toString();
    const spender = recipient.toString();
    const amount = 1000n;

    // Set an allowance (nested mapping)
    const trace = await traceStorageAccess({
      client,
      from: caller.toString(),
      to: Mappings.address,
      abi: Mappings.abi,
      functionName: "setAllowance",
      args: [owner, spender, amount],
    });

    // Verify the write operation
    expect(trace[Mappings.address].storage).toEqual(
      expectedStorage(LAYOUTS.Mappings, {
        allowances: {
          name: "allowances",
          type: "mapping(address => mapping(address => uint256))",
          kind: "mapping",
          trace: [
            {
              current: { hex: toHex(0, { size: 1 }), decoded: 0n },
              next: { hex: toHex(amount, { size: 32 }), decoded: amount },
              modified: true,
              slots: [getMappingSlotHex(1, owner, spender)],
              path: [
                {
                  kind: PathSegmentKind.MappingKey,
                  key: owner,
                  keyType: "address",
                },
                {
                  kind: PathSegmentKind.MappingKey,
                  key: spender,
                  keyType: "address",
                },
              ],
              fullExpression: `allowances[${owner}][${spender}]`,
            },
          ],
        },
      }),
    );
  });

  it("... even with a ridiculously nested mapping", async () => {
    const client = getClient();
    const [a, b, c, d] = Array.from({ length: 4 }, (_, i) =>
      getAddress(`0xad${i.toString().repeat(38)}`.toLowerCase()),
    );
    const value = 1000n;

    const trace = await traceStorageAccess({
      client,
      from: caller.toString(),
      to: Mappings.address,
      abi: Mappings.abi,
      functionName: "setRidiculouslyNestedMapping",
      args: [a, b, c, d, value],
    });

    // Verify the write operation
    expect(trace[Mappings.address].storage).toEqual(
      expectedStorage(LAYOUTS.Mappings, {
        ridiculouslyNestedMapping: {
          name: "ridiculouslyNestedMapping",
          type: "mapping(address => mapping(address => mapping(address => mapping(address => uint256))))",
          kind: "mapping",
          trace: [
            {
              current: { hex: toHex(0, { size: 1 }), decoded: 0n },
              next: { hex: toHex(value, { size: 32 }), decoded: value },
              modified: true,
              slots: [getMappingSlotHex(2, a, b, c, d)],
              path: [
                {
                  kind: PathSegmentKind.MappingKey,
                  key: a,
                  keyType: "address",
                },
                {
                  kind: PathSegmentKind.MappingKey,
                  key: b,
                  keyType: "address",
                },
                {
                  kind: PathSegmentKind.MappingKey,
                  key: c,
                  keyType: "address",
                },
                {
                  kind: PathSegmentKind.MappingKey,
                  key: d,
                  keyType: "address",
                },
              ],
              fullExpression: `ridiculouslyNestedMapping[${a}][${b}][${c}][${d}]`,
            },
          ],
        },
      }),
    );
  });

  it("should trace mapping with struct values slot access", async () => {
    const client = getClient();
    const user = recipient.toString();
    const balance = 2000n;
    const lastUpdate = 123456n;
    const isActive = true;

    // Set a struct in the userInfo mapping
    const trace = await traceStorageAccess({
      client,
      from: caller.toString(),
      to: Mappings.address,
      abi: Mappings.abi,
      functionName: "setUserInfo",
      args: [user, balance, lastUpdate, isActive],
    });

    const userMappingSlot = getMappingSlotHex(3, user);
    expect(trace[Mappings.address].storage).toEqual(
      expectedStorage(LAYOUTS.Mappings, {
        userInfo: {
          name: "userInfo",
          type: "mapping(address => struct Mappings.UserInfo)",
          kind: "mapping",
          trace: [
            {
              current: {
                hex: toHex(0, { size: 1 }),
                decoded: 0n,
              },
              next: {
                hex: toHex(2000, { size: 32 }),
                decoded: 2000n,
              },
              modified: true,
              slots: [userMappingSlot],
              path: [
                {
                  kind: PathSegmentKind.MappingKey,
                  key: user,
                  keyType: "address",
                },
                {
                  kind: PathSegmentKind.StructField,
                  name: "balance",
                },
              ],
              fullExpression: `userInfo[${user}].balance`,
            },
            {
              current: {
                hex: toHex(0, { size: 1 }),
                decoded: 0n,
              },
              next: {
                hex: toHex(123456, { size: 32 }),
                decoded: 123456n,
              },
              modified: true,
              slots: [getSlotAtOffsetHex(userMappingSlot, 1)],
              path: [
                {
                  kind: PathSegmentKind.MappingKey,
                  key: user,
                  keyType: "address",
                },
                {
                  kind: PathSegmentKind.StructField,
                  name: "lastUpdate",
                },
              ],
              fullExpression: `userInfo[${user}].lastUpdate`,
            },
            {
              current: {
                hex: toHex(0, { size: 1 }),
                decoded: false,
              },
              next: {
                hex: toHex(1, { size: 1 }),
                decoded: true,
              },
              modified: true,
              slots: [getSlotAtOffsetHex(userMappingSlot, 2)],
              path: [
                {
                  kind: PathSegmentKind.MappingKey,
                  key: user,
                  keyType: "address",
                },
                {
                  kind: PathSegmentKind.StructField,
                  name: "isActive",
                },
              ],
              fullExpression: `userInfo[${user}].isActive`,
            },
          ],
        },
      }),
    );
  });

  it("should trace complex mapping operations with multiple keys", async () => {
    const client = getClient();
    const user = recipient.toString();

    // First set up the initial struct
    await traceStorageAccess({
      client,
      from: caller.toString(),
      to: Mappings.address,
      abi: Mappings.abi,
      functionName: "setUserInfo",
      args: [user, 100n, 100n, true],
    });

    // Now update just the balance field
    const newBalance = 300n;
    const trace = await traceStorageAccess({
      client,
      from: caller.toString(),
      to: Mappings.address,
      abi: Mappings.abi,
      functionName: "updateUserBalance",
      args: [user, newBalance],
    });

    // We should see writes to both balance and lastUpdate fields, but not isActive
    const userMappingSlot = getMappingSlotHex(3, user);
    expect(trace[Mappings.address].storage).toEqual(
      expectedStorage(LAYOUTS.Mappings, {
        userInfo: {
          name: "userInfo",
          type: "mapping(address => struct Mappings.UserInfo)",
          kind: "mapping",
          trace: [
            {
              current: {
                hex: toHex(100, { size: 32 }),
                decoded: 100n,
              },
              next: {
                hex: toHex(300, { size: 32 }),
                decoded: 300n,
              },
              modified: true,
              slots: [userMappingSlot],
              path: [
                {
                  kind: PathSegmentKind.MappingKey,
                  key: user,
                  keyType: "address",
                },
                {
                  kind: PathSegmentKind.StructField,
                  name: "balance",
                },
              ],
              fullExpression: `userInfo[${user}].balance`,
            },
            {
              current: {
                hex: toHex(100, { size: 32 }),
                decoded: 100n,
              },
              next: {
                hex: expect.any(String),
                decoded: expect.any(BigInt),
              },
              modified: true,
              slots: [getSlotAtOffsetHex(userMappingSlot, 1)],
              path: [
                {
                  kind: PathSegmentKind.MappingKey,
                  key: user,
                  keyType: "address",
                },
                {
                  kind: PathSegmentKind.StructField,
                  name: "lastUpdate",
                },
              ],
              fullExpression: `userInfo[${user}].lastUpdate`,
            },
          ],
        },
      }),
    );
    const lastUpdateTrace = trace[Mappings.address].storage.userInfo.trace.find((t) =>
      t.fullExpression.includes("lastUpdate"),
    );
    assert(lastUpdateTrace?.modified);
    expect(lastUpdateTrace.next.decoded).toBeGreaterThan(100n);
  });

  it("should trace mapping to an array", async () => {
    const client = getClient();
    const index = 1n; // the mapping key
    const value = 100n; // the value to push to the array

    const trace = await traceStorageAccess({
      client,
      from: caller.toString(),
      to: Mappings.address,
      abi: Mappings.abi,
      functionName: "setArrayMapping",
      args: [index, value],
    });

    expect(trace[Mappings.address].storage).toEqual(
      expectedStorage(LAYOUTS.Mappings, {
        arrayMapping: {
          name: "arrayMapping",
          type: "mapping(uint256 => uint256[])",
          kind: "mapping",
          trace: [
            {
              current: { hex: toHex(0, { size: 1 }), decoded: 0n },
              next: { hex: toHex(1, { size: 1 }), decoded: 1n },
              modified: true,
              slots: [getMappingSlotHex(4, toHex(index, { size: 32 }))],
              path: [
                {
                  kind: PathSegmentKind.MappingKey,
                  key: index,
                  keyType: "uint256",
                },
                {
                  kind: PathSegmentKind.ArrayLength,
                  name: "_length",
                },
              ],
              fullExpression: `arrayMapping[${index}]._length`,
            },
            {
              current: { hex: toHex(0, { size: 1 }), decoded: 0n },
              next: { hex: toHex(value, { size: 32 }), decoded: value },
              modified: true,
              slots: [getArraySlotHex(getMappingSlotHex(4, toHex(index, { size: 32 })), 0)],
              path: [
                {
                  kind: PathSegmentKind.MappingKey,
                  key: index,
                  keyType: "uint256",
                },
                {
                  kind: PathSegmentKind.ArrayIndex,
                  index: 0n,
                },
              ],
              fullExpression: `arrayMapping[${index}][0]`,
            },
          ],
        },
      }),
    );
  });
});
