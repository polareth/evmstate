import type { Address, MemoryClient } from "tevm";
import { createMemoryClient, createSyncStoragePersister, parseEther } from "tevm";
import { EthjsAddress } from "tevm/utils";
import type { ExtractAbiFunctions } from "abitype";
import { ArrowRight } from "lucide-react";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createHighlighter, type Highlighter, type ThemeRegistrationAny } from "shiki";
import type { ContractFunctionArgs } from "viem";

import { traceState } from "@polareth/evmstate";
import * as CONTRACTS from "@test/contracts/index.js";
import * as LAYOUTS from "@test/generated/layouts/index.js";

import { Button } from "~/components/button.js";
import { CodeBlock, type CodeBlockRef } from "~/components/code-block/index.js";
import { usePlaygroundStore } from "~/components/stores/trace-store.js";
import themeLight from "~/themes/theme-light.json" with { type: "json" };

const contract = CONTRACTS["Playground"].withAddress(
  EthjsAddress.fromString("0x987C2AF139EAEaBdF8D6d3d1723C1883bEa1f2AF").toString(),
);
const layout = LAYOUTS["Playground"];
const callerAddress = EthjsAddress.fromString("0xCa11e40000000000000000000000000000000000");
const localStorageKey = "EVMSTATE_PLAYGROUND_STATE";

// Function descriptions for the Playground contract
const functionDescriptions: Record<ExtractAbiFunctions<typeof contract.abi, "nonpayable">["name"], string> = {
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

export const Playground = () => {
  const [client, setClient] = useState<MemoryClient | undefined>(undefined);
  const { traces, addTrace, clearTraces } = usePlaygroundStore();

  const [highlighter, setHighlighter] = useState<Highlighter | undefined>(undefined);
  useEffect(() => {
    const initHighlighter = async () => {
      const highlighter = await createHighlighter({
        themes: ["poimandres", themeLight as ThemeRegistrationAny],
        langs: ["typescript"],
      });

      setHighlighter(highlighter);
    };

    initHighlighter();
  }, []);

  const [selectedFunction, setSelectedFunction] = useState<ExtractAbiFunctions<typeof contract.abi, "nonpayable">>(
    contract.abi.find(
      (item) => item.type === "function" && item.name === Object.keys(functionDescriptions)[0],
    ) as ExtractAbiFunctions<typeof contract.abi, "nonpayable">,
  );
  const [args, setArgs] = useState<
    ContractFunctionArgs<typeof contract.abi, "nonpayable", typeof selectedFunction.name> | never[]
  >([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Ref to hold the array of CodeBlock refs for traces
  const traceCodeBlockRefs = useRef<Array<CodeBlockRef | null>>([]);

  // Update refs array when traces change
  useEffect(() => {
    // Resize the refs array to match the traces array
    traceCodeBlockRefs.current = traceCodeBlockRefs.current.slice(0, traces.length);
    while (traceCodeBlockRefs.current.length < traces.length) {
      traceCodeBlockRefs.current.push(null);
    }
  }, [traces.length]);

  const init = useCallback(async () => {
    if (typeof window === "undefined") return;
    setIsLoading(true);

    // Init the client
    const client = createMemoryClient({
      persister: createSyncStoragePersister({
        storage: localStorage,
        key: localStorageKey,
      }),
    });
    setClient(client);

    // Get the account first to see if we initialized already in the past
    const account = await client.tevmGetAccount({ address: callerAddress.toString(), throwOnFail: false });
    if (account && account.nonce !== 0n) {
      setIsLoading(false);
      return;
    }

    try {
      const { errors } = await client.tevmSetAccount({
        address: callerAddress.toString(),
        nonce: 0n,
        balance: parseEther("100"),
      });
      if (errors) throw new Error(errors.map((e) => e.message).join("\n"));
    } catch (err) {
      console.error("Failed to initialize caller account:", err);
      setError("Failed to initialize caller account");
    }

    try {
      // Deploy the contract
      const { txHash } = await client.tevmDeploy({
        from: callerAddress.toString(),
        abi: contract.abi,
        bytecode: contract.bytecode,
        args: [callerAddress.toString(), "Playground"],
        addToBlockchain: true,
      });
      if (!txHash) throw new Error("txHash is undefined");

      // Get a trace for deployment
      const state = await traceState({
        client,
        txHash,
        fetchContracts: false,
        fetchStorageLayouts: false,
        // something nice is that we can already provide the layout as we know the address it will be deployed to
        storageLayouts: { [contract.address.toLowerCase()]: layout },
      });

      // Use the store's addTrace method instead
      addTrace({
        functionName: "deploy",
        args: [callerAddress.toString(), "Playground"],
        state,
      });
    } catch (err) {
      console.error("Failed to deploy contract:", err);
      setError("Failed to deploy contract");
    }

    setIsLoading(false);
  }, [addTrace]);

  // Init client, caller account and deploy contract on component mount
  useEffect(() => {
    init();
  }, [contract, addTrace]);

  // Handle function selection change
  const handleFunctionChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const funcName = e.target.value;
    const func = contract.abi.find((f) => f.type === "function" && f.name === funcName) ?? undefined;
    if (!func) throw new Error(`Function ${funcName} not found`);
    setSelectedFunction(func as ExtractAbiFunctions<typeof contract.abi, "nonpayable">);
    setArgs([]);
  };

  // Handle argument input change
  const handleArgChange = (index: number, value: string) => {
    const newArgs = [...(args ?? [])];
    newArgs[index] = value;
    // @ts-expect-error - not typed
    setArgs(newArgs);
  };

  // Execute function
  const executeFunction = async () => {
    if (!client) return;

    try {
      setError(null);
      setIsLoading(true);

      // Get the state
      const state = await traceState({
        client,
        from: callerAddress.toString(),
        to: contract.address,
        storageLayouts: { [contract.address.toLowerCase()]: layout },
        fetchContracts: false,
        fetchStorageLayouts: false,
        abi: contract.abi,
        functionName: selectedFunction.name,
        // @ts-expect-error - args mismatch
        args,
      });

      // Actually execute the function for follow-up
      await client.tevmContract({
        from: callerAddress.toString(),
        to: contract.address,
        abi: contract.abi,
        functionName: selectedFunction.name,
        // @ts-expect-error - args mismatch
        args,
        addToBlockchain: true,
      });

      // Add to traces history
      const newTrace = {
        functionName: selectedFunction.name,
        args: [...args],
        state,
      };
      addTrace(newTrace);
      console.log(newTrace);
      // Collapse all existing traces and expand the new one
      traceCodeBlockRefs.current.forEach((ref) => ref?.collapse());
    } catch (err) {
      setError(`Error executing function: ${err instanceof Error ? err.message : JSON.stringify(err)}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Function to collapse all trace CodeBlocks
  const handleCollapseAllTraces = () => {
    traceCodeBlockRefs.current.forEach((ref) => {
      if (ref) ref.collapse();
    });
  };

  const handleReset = async () => {
    if (typeof window === "undefined") return;
    localStorage.removeItem(localStorageKey);
    clearTraces(); // Use the store's clearTraces method
    await init();
  };

  const codeBlocks = useMemo(() => {
    if (!highlighter) return [];
    return traces.map((trace, index) => (
      <CodeBlock
        key={index}
        highlighter={highlighter}
        ref={(el) => {
          traceCodeBlockRefs.current[index] = el;
        }}
        fileName={`${trace.functionName}(
              ${trace.args
                .map((arg) =>
                  typeof arg === "string" ? `"${arg}"` : typeof arg === "bigint" ? `${arg.toString()}n` : String(arg),
                )
                .join(", ")}
              )`}
        caption={
          <div className="flex items-center gap-x-2 text-accent">
            <ArrowRight className="size-3 mt-0.5" />
            <span className="font-mono text-sm font-medium text-xs">
              {Object.keys(JSON.parse(trace.state)[contract.address.toLowerCase() as Address]?.storage ?? {}).join(
                ", ",
              )}
            </span>
          </div>
        }
        collapsible={true}
      >
        {trace.state}
      </CodeBlock>
    ));
  }, [traces, highlighter]);

  // Render UI
  return (
    <div className="playground">
      <div className="flex flex-col gap-y-2">
        <div>
          <label className="font-medium">Function</label>
          <select value={selectedFunction?.name ?? ""} onChange={handleFunctionChange}>
            {Object.entries(functionDescriptions).map(([funcName, description]) => (
              <option key={funcName} value={funcName}>
                {funcName} - {description}
              </option>
            ))}
          </select>
        </div>

        {selectedFunction && selectedFunction.inputs.length > 0 && (
          <div className="flex flex-col gap-y-2">
            {selectedFunction.inputs.map((input, index) => (
              <div key={`${"name" in input ? input.name : "arg"}-${index}`}>
                <label>
                  <span className="vocs_Code">
                    {"name" in input ? input.name : `Arg ${index + 1}`} ({input.type})
                  </span>
                  <input
                    type="text"
                    // @ts-expect-error - type inconsistency
                    value={args[index] ?? ""}
                    onChange={(e) => handleArgChange(index, e.target.value)}
                    placeholder={`Enter ${input.type} value`}
                  />
                </label>
              </div>
            ))}
          </div>
        )}

        <Button onClick={executeFunction} disabled={!client || isLoading || !selectedFunction} className="col-span-2">
          {isLoading ? "Running..." : "Execute"}
        </Button>
      </div>

      {error && <div className="error-message p-2 bg-red-100 text-red-700 rounded">{error}</div>}

      {/* Traces History */}
      <div className="flex flex-col gap-y-2">
        <div className="flex items-center gap-x-2">
          <h3 className="text-xl font-medium flex-1">Traces</h3>
          <Button variant="ghost" onClick={handleCollapseAllTraces} className="text-muted">
            collapse all
          </Button>
          <Button variant="destructive" onClick={handleReset} className="text-muted">
            reset
          </Button>
        </div>
        <div className="flex flex-col gap-y-1 pr-1">{codeBlocks.reverse()}</div>
      </div>

      {traces.length === 0 && !error && (
        <div className="flex items-center justify-center font-medium text-muted mt-6 p-4">
          <p>Run a function to see the trace</p>
        </div>
      )}
    </div>
  );
};
