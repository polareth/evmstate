import type { MemoryClient } from "tevm";
import { createMemoryClient, createSyncStoragePersister, parseEther } from "tevm";
import type { ExtractAbiFunctions } from "abitype";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { createHighlighter, type Highlighter, type ThemeRegistrationAny } from "shiki";
import type { ContractFunctionArgs } from "viem";

import { traceState } from "@polareth/evmstate";

import { type CodeBlockRef } from "~/components/code-block/index.js";
import {
  callerAddress,
  contract,
  functionDescriptions,
  layout,
  localStorageKey,
} from "~/components/playground/constants.js";
import { usePlaygroundStore } from "~/components/stores/trace-store.js";
import themeLight from "~/themes/theme-light.json" with { type: "json" };

export const usePlayground = () => {
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

  return {
    client,
    traces,
    addTrace,
    clearTraces,
    traceCodeBlockRefs,
    highlighter,
    selectedFunction,
    args,
    isLoading,
    error,
    handleFunctionChange,
    handleArgChange,
    executeFunction,
    handleCollapseAllTraces,
    handleReset,
  };
};
