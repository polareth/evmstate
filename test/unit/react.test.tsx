// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import React, { useEffect, useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { ACCOUNTS, CONTRACTS, LAYOUTS } from "@test/constants";
import { expectedStorage, getClient, getSlotHex } from "@test/utils";
import { Tracer } from "@/lib/trace";
import { TracerProvider, useTracer } from "@/react";
import { toHex } from "viem";

const { StoragePacking } = CONTRACTS;
const { caller } = ACCOUNTS;

// 1. Test Component using the hook successfully
const TestComponent = () => {
  const tracer = useTracer();
  const isTracerInstance = tracer instanceof Tracer;
  return <div>Tracer instance found: {isTracerInstance ? "yes" : "no"}</div>;
};

// 2. Test Component that will cause the hook to throw (used outside provider)
const ErrorComponent = () => {
  let errorMessage = "No error";
  try {
    useTracer();
  } catch (e) {
    if (e instanceof Error) {
      errorMessage = e.message;
    } else {
      errorMessage = "Caught non-Error object";
    }
  }
  return <div>Hook Result: {errorMessage}</div>;
};

// 3. Test Component that will correctly trace storage access
const StorageAccessComponent = () => {
  const { traceStorageAccess } = useTracer();
  const [trace, setTrace] = useState<string | undefined>();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setIsLoading(true);
      setError(null);
      try {
        const fullTrace = await traceStorageAccess({
          from: caller.toString(),
          to: StoragePacking.address,
          abi: StoragePacking.abi,
          functionName: "setSmallValues",
          args: [1, 2, true, caller.toString()],
        });
        setTrace(JSON.stringify(fullTrace[StoragePacking.address].storage, null, 2));
      } catch (e) {
        setError(e instanceof Error ? e.message : "An unknown error occurred");
      } finally {
        setIsLoading(false);
      }
    })();
  }, [traceStorageAccess]);

  if (isLoading) return <div>Loading storage trace...</div>;
  if (error) return <div>Error: {error}</div>;

  return <div>Storage trace: {trace}</div>;
};

describe("React", () => {
  it("should provide Tracer instance via useTracer when wrapped in TracerProvider", () => {
    render(
      <TracerProvider client={getClient()}>
        <TestComponent />
      </TracerProvider>,
    );

    expect(screen.getByText("Tracer instance found: yes")).toBeDefined();
  });

  it("should throw an error when useTracer is used outside of TracerProvider", () => {
    // Render the component that attempts to use the hook without a provider
    render(<ErrorComponent />);
    expect(screen.getByText("Hook Result: useTracer must be used within a TracerProvider")).toBeDefined();
  });

  it("should correctly trace storage access via hook", async () => {
    render(
      <TracerProvider client={getClient()}>
        <StorageAccessComponent />
      </TracerProvider>,
    );

    expect(screen.getByText("Loading storage trace...")).toBeDefined();

    const resultElement = await screen.findByText(/^Storage trace: \{/i, {}, { timeout: 10000 });
    expect(JSON.parse(resultElement.textContent?.replace("Storage trace: ", "") ?? "")).toEqual(
      expectedStorage(LAYOUTS.StoragePacking, {
        smallValue1: {
          name: "smallValue1",
          type: "uint8",
          kind: "primitive",
          trace: [
            {
              current: { hex: toHex(0, { size: 1 }), decoded: 0 },
              next: { hex: toHex(1, { size: 1 }), decoded: 1 },
              modified: true,
              slots: [getSlotHex(0)],
              path: [],
              fullExpression: "smallValue1",
            },
          ],
        },
        smallValue2: {
          name: "smallValue2",
          type: "uint8",
          kind: "primitive",
          trace: [
            {
              current: { hex: toHex(0, { size: 1 }), decoded: 0 },
              next: { hex: toHex(2, { size: 1 }), decoded: 2 },
              modified: true,
              slots: [getSlotHex(0)],
              path: [],
              fullExpression: "smallValue2",
            },
          ],
        },
        flag: {
          name: "flag",
          type: "bool",
          kind: "primitive",
          trace: [
            {
              current: { hex: toHex(0, { size: 1 }), decoded: false },
              next: { hex: toHex(1, { size: 1 }), decoded: true },
              modified: true,
              slots: [getSlotHex(0)],
              path: [],
              fullExpression: "flag",
            },
          ],
        },
        someAddress: {
          name: "someAddress",
          type: "address",
          kind: "primitive",
          trace: [
            {
              current: {
                hex: toHex(0, { size: 1 }),
                decoded: toHex(0, { size: 20 }),
              },
              next: { hex: caller.toString(), decoded: caller.toString() },
              modified: true,
              slots: [getSlotHex(0)],
              path: [],
              fullExpression: "someAddress",
            },
          ],
        },
      }),
    );
  });
});
