import type { Address } from "tevm";
import { ArrowRight } from "lucide-react";
import { useMemo } from "react";

import { Button } from "~/components/button.js";
import { CodeBlock } from "~/components/code-block/index.js";
import { usePlayground } from "~/components/hooks/use-playground.js";
import { contract, functionDescriptions } from "~/components/playground/constants.js";

export const Playground = () => {
  const {
    client,
    traces,
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
  } = usePlayground();

  const codeBlocks = useMemo(() => {
    if (!highlighter) return [];
    return traces
      .map((trace, index) => (
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
      ))
      .reverse();
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
        <div className="flex flex-col gap-y-1 pr-1">{codeBlocks}</div>
      </div>

      {traces.length === 0 && !error && (
        <div className="flex items-center justify-center font-medium text-muted mt-6 p-4">
          <p>Run a function to see the trace</p>
        </div>
      )}
    </div>
  );
};
