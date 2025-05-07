// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { useEffect, useState } from "react";
import { describe, expect, it } from "vitest";

import { ACCOUNTS, CONTRACTS } from "@test/constants.js";
import { getClient } from "@test/utils.js";
import { TracerProvider, useTracer } from "@/lib/react/index.js";

const { StoragePacking } = CONTRACTS;
const { caller } = ACCOUNTS;

// 1. Test Component that will cause the hook to throw (used outside provider)
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

// 2. Test Component that will correctly trace storage access
const StateComponent = () => {
  const { traceState } = useTracer();
  const [trace, setTrace] = useState<string | undefined>();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setIsLoading(true);
      setError(null);
      try {
        const trace = await traceState({
          ...StoragePacking.write.setSmallValues(1, 2, true, caller.toString()),
          from: caller.toString(),
        });
        setTrace(JSON.stringify(trace, (_, v) => (typeof v === "bigint" ? v.toString() : v), 2));
      } catch (e) {
        setError(e instanceof Error ? e.message : "An unknown error occurred");
      } finally {
        setIsLoading(false);
      }
    })();
  }, [traceState]);

  if (isLoading) return <div>Loading storage trace...</div>;
  if (error) return <div>Error: {error}</div>;

  return <div>Storage trace: {trace}</div>;
};

describe("React", () => {
  it("should correctly trace storage access via hook", async () => {
    render(
      <TracerProvider client={getClient()}>
        <StateComponent />
      </TracerProvider>,
    );

    expect(screen.getByText("Loading storage trace...")).toBeDefined();
    const resultElement = await screen.findByText(/^Storage trace: \{/i, {}, { timeout: 10000 });
    expect(JSON.parse(resultElement.textContent?.replace("Storage trace: ", "") ?? "")).toMatchSnapshot();
  });

  it("should throw an error when useTracer is used outside of TracerProvider", () => {
    // Render the component that attempts to use the hook without a provider
    render(<ErrorComponent />);
    expect(screen.getByText("Hook Result: useTracer must be used within a TracerProvider")).toBeDefined();
  });
});
