import type { Address } from "tevm";
import { createMemoryClient, parseEther } from "tevm";
import type { ExtractAbiFunctions } from "abitype";
import { ArrowRight } from "lucide-react";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { createHighlighter, type Highlighter, type ThemeRegistrationAny } from "shiki";
import type { ContractFunctionArgs } from "viem";

import { traceState, type LabeledStateDiff } from "@polareth/evmstate";
import * as CONTRACTS from "@test/contracts/index.js";
import * as LAYOUTS from "@test/generated/layouts/index.js";

import { Button } from "~/components/button.js";
import { CodeBlock, type CodeBlockRef } from "~/components/code-block/index.js";
import themeLight from "~/themes/theme-light.json" with { type: "json" };
import { stringify } from "~/utils.js";

const contract = CONTRACTS["Playground"];
const layout = LAYOUTS["Playground"];
const callerAddress = "0xca11e40000000000000000000000000000000000";

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
  const clientRef = useRef(createMemoryClient());
  const [highlighter, setHighlighter] = useState<Highlighter | null>(null);
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
  const [traces, setTraces] = useState<
    Array<{
      functionName: ExtractAbiFunctions<typeof contract.abi>["name"] | "deploy";
      args: any[];
      diff: Record<Address, LabeledStateDiff>;
    }>
  >([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const contractAddressRef = useRef<Address | null>(null);

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

  // Init caller account and deploy contract on component mount
  useEffect(() => {
    const initCallerAccount = async () => {
      setIsLoading(true);
      try {
        const { errors } = await clientRef.current.tevmSetAccount({
          address: callerAddress,
          nonce: 0n,
          balance: parseEther("100"),
        });
        if (errors) throw new Error(errors.map((e) => e.message).join("\n"));
      } catch (err) {
        console.error("Failed to initialize caller account:", err);
        setError("Failed to initialize caller account");
      } finally {
        setIsLoading(false);
      }
    };

    const deployContract = async () => {
      try {
        setIsLoading(true);

        // Deploy the contract
        const { txHash, createdAddress } = await clientRef.current.tevmDeploy({
          from: callerAddress,
          abi: contract.abi,
          bytecode: contract.bytecode,
          args: [callerAddress, "Playground"],
          addToBlockchain: true,
        });
        if (!createdAddress) throw new Error("createdAddress is undefined");
        if (!txHash) throw new Error("txHash is undefined");

        // Get a trace for deployment
        const diff = await traceState({
          client: clientRef.current,
          txHash,
          fetchContracts: false,
          fetchStorageLayouts: false,
          // something nice is that we can already provide the layout as we know the address it will be deployed to
          storageLayouts: { [createdAddress]: layout },
        });
        setTraces((prev) => [
          {
            functionName: "deploy",
            args: [callerAddress, "Playground"],
            diff,
          },
          ...prev,
        ]);

        // Set the contract address
        contractAddressRef.current = createdAddress;
      } catch (err) {
        console.error("Failed to deploy contract:", err);
        setError("Failed to deploy contract");
      } finally {
        setIsLoading(false);
      }
    };

    // TODO: do all this only if first visit, otherwise if we retrieve a client state don't and get the contract address from the first block tx
    initCallerAccount().then(deployContract);
  }, [contract]);

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
    if (!contractAddressRef.current) {
      setError("Contract not deployed or account not initialized");
      setIsLoading(false);
      return;
    }

    try {
      setError(null);
      setIsLoading(true);

      // Get the diff
      const diff = await traceState({
        client: clientRef.current,
        from: callerAddress,
        to: contractAddressRef.current,
        storageLayouts: { [contractAddressRef.current]: layout },
        fetchContracts: false,
        fetchStorageLayouts: false,
        abi: contract.abi,
        functionName: selectedFunction.name,
        // @ts-expect-error - args mismatch
        args,
      });

      // Actually execute the function for follow-up
      await clientRef.current.tevmContract({
        from: callerAddress,
        to: contractAddressRef.current,
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
        diff,
      };
      setTraces((prev) => [...prev, newTrace]);
      console.log(newTrace);
      // Collapse all existing traces and expand the new one
      traceCodeBlockRefs.current.forEach((ref) => ref?.collapse());
    } catch (err) {
      console.error(`Error executing function: ${err instanceof Error ? err.message : JSON.stringify(err)}`);
      setError(`Error executing function: ${err instanceof Error ? err.message : "Unknown error"}`);
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
              {Object.keys(
                trace.diff[(contractAddressRef.current?.toLowerCase() ?? "0x") as Address].storage ?? {},
              ).join(", ")}
            </span>
          </div>
        }
        collapsible={true}
      >
        {stringify(trace.diff)}
      </CodeBlock>
    ));
  }, [traces, highlighter]);

  // Render UI
  return (
    <div className="playground">
      <div className="flex flex-col gap-y-2">
        <div>
          <label className="font-medium">Function</label>
          <select value={selectedFunction?.name ?? ""} onChange={handleFunctionChange} disabled={isLoading}>
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
                    disabled={isLoading}
                    placeholder={`Enter ${input.type} value`}
                  />
                </label>
              </div>
            ))}
          </div>
        )}

        <Button onClick={executeFunction} disabled={isLoading || !selectedFunction} className="col-span-2">
          {isLoading ? "Running..." : "Execute"}
        </Button>
      </div>

      {error && <div className="error-message p-2 bg-red-100 text-red-700 rounded">{error}</div>}

      {/* Traces History */}
      {highlighter && traces.length > 0 && (
        <div className="flex flex-col gap-y-2">
          <div className="flex justify-between items-center gap-x-2">
            <h3 className="text-xl font-medium">Traces</h3>
            {/* Button to collapse all traces */}
            <Button variant="ghost" onClick={handleCollapseAllTraces} className="text-muted">
              collapse all
            </Button>
          </div>
          <div className="flex flex-col gap-y-1 pr-1">{codeBlocks.reverse()}</div>
        </div>
      )}

      {traces.length === 0 && !error && (
        <div className="flex items-center justify-center font-medium opacity-70 mt-6 p-4">
          <p>Run a function to see the trace</p>
        </div>
      )}
    </div>
  );
};
