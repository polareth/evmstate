import type { AbiParametersToPrimitiveTypes, Address } from "tevm";
import { createMemoryClient, parseEther } from "tevm";
import type { ExtractAbiFunctions } from "abitype";
import React, { useEffect, useMemo, useRef, useState } from "react";
import type { ContractFunctionArgs } from "viem";

import { traceState, type LabeledStateDiff } from "@polareth/evmstate";
import * as CONTRACTS from "@test/contracts/index.js";
import * as LAYOUTS from "@test/generated/layouts/index.js";

import { Button } from "~/components/button.js";
import CodeBlock from "~/components/code-block/index.js";

const callerAddress = "0xca11e40000000000000000000000000000000000";

type PlaygroundProps<
  TContract extends keyof typeof CONTRACTS & keyof typeof LAYOUTS = keyof typeof CONTRACTS & keyof typeof LAYOUTS,
> = {
  contract: TContract;
  creationArgs?: AbiParametersToPrimitiveTypes<
    Extract<(typeof CONTRACTS)[TContract]["abi"][number], { type: "constructor" }>["inputs"]
  >;
};

export const Playground = <TContract extends keyof typeof CONTRACTS & keyof typeof LAYOUTS>({
  contract: contractKey,
  creationArgs,
}: PlaygroundProps<TContract>) => {
  const clientRef = useRef(createMemoryClient());
  const contract = CONTRACTS[contractKey];
  const layout = LAYOUTS[contractKey];
  const [selectedFunction, setSelectedFunction] = useState<ExtractAbiFunctions<typeof contract.abi>>(
    contract.abi.filter((item) => item.type === "function")[0],
  );
  const [args, setArgs] = useState<
    | ContractFunctionArgs<typeof contract.abi, typeof selectedFunction.stateMutability, typeof selectedFunction.name>
    | never[]
  >([]);
  const [stateDiff, setStateDiff] = useState<Record<Address, LabeledStateDiff> | undefined>();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const contractAddressRef = useRef<Address | null>(null);

  // Filter functions from ABI
  const functions = useMemo(() => contract.abi.filter((item) => item.type === "function"), [contract.abi]);

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

        // @ts-ignore
        const { createdAddress } = await clientRef.current.tevmDeploy({
          abi: contract.abi,
          bytecode: contract.bytecode,
          args: creationArgs,
          addToBlockchain: true,
        });
        if (!createdAddress) throw new Error("createdAddress is undefined");
        contractAddressRef.current = createdAddress;
      } catch (err) {
        console.error("Failed to deploy contract:", err);
        setError("Failed to deploy contract");
      } finally {
        setIsLoading(false);
      }
    };

    initCallerAccount().then(deployContract);
  }, [contract]);

  // Handle function selection change
  const handleFunctionChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const funcName = e.target.value;
    const func = functions.find((f) => f.name === funcName) || undefined;
    if (!func) throw new Error(`Function ${funcName} not found`);
    setSelectedFunction(func);
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
      setStateDiff(diff);

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
    } catch (err) {
      console.error(`Error executing function: ${err instanceof Error ? err.message : JSON.stringify(err)}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Render UI
  return (
    <div className="playground">
      <div className="playground-controls text-sm">
        <div>
          <label className="vocs_Code">
            Function
            <select value={selectedFunction?.name || ""} onChange={handleFunctionChange} disabled={isLoading}>
              {functions.map((func) => (
                <option key={func.name} value={func.name}>
                  {func.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        {selectedFunction && selectedFunction.inputs.length > 0 && (
          <div className="flex flex-col gap-y-2">
            {selectedFunction.inputs.map((input, index) => (
              <div key={`${input.name || "arg"}-${index}`}>
                <label className="vocs_Code">
                  {input.name ?? `Arg ${index + 1}`}
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

      <div>
        {error && <div className="error-message">{error}</div>}
        {!!stateDiff && (
          <CodeBlock fileName="output" language="js" showLineNumbers={false} containerized={false} collapsible={true}>
            {stateDiff}
          </CodeBlock>
        )}
        {!stateDiff && !error && (
          <div className="flex items-center justify-center font-medium opacity-70">
            <p>Run a function to see the trace</p>
          </div>
        )}
      </div>
    </div>
  );
};
