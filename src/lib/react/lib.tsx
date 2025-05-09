import React, { createContext, useContext, useMemo, type ReactNode } from "react";

import { type ExploreStorageConfig } from "@/lib/explore/config.js";
import { Tracer } from "@/lib/trace/index.js";
import type { TraceStateBaseOptions } from "@/lib/trace/types.js";

// Define the context type
type TracerContextType = Tracer | null;

// Create the context with a default null value
export const TracerContext = createContext<TracerContextType>(null);

interface TracerProviderProps extends TraceStateBaseOptions {
  config?: ExploreStorageConfig;
  children: ReactNode;
}

/**
 * Provides a Tracer instance to its children components via context. It initializes the Tracer with the provided
 * options.
 *
 * @unsupported - This provider should not be used if you want to follow the chain, as rebase mode is not available yet. Meaning that in the case of a fork client, it won't follow the state of the fork. For now, you should use the `traceState` function directly, and refork in case you want to use the latest state of the forked chain.
 */
export const TracerProvider: React.FC<TracerProviderProps> = ({ children, ...options }) => {
  // Memoize the Tracer instance to avoid recreating it on every render unless the options change.
  const tracer = useMemo(
    () => new Tracer(options),
    [options.client, options.rpcUrl, options.common, options.explorers, options.config],
  );

  return <TracerContext.Provider value={tracer}>{children}</TracerContext.Provider>;
};

/**
 * Custom hook to access the Tracer instance provided by TracerProvider.
 *
 * @returns The Tracer instance.
 * @throws Error if used outside of a TracerProvider.
 * @unsupported - This hook should not be used if you want to follow the chain, as rebase mode is not available yet. Meaning that in the case of a fork client, it won't follow the state of the fork. For now, you should use the `traceState` function directly, and refork in case you want to use the latest state of the forked chain.
 */
export const useTracer = (): Tracer => {
  const context = useContext(TracerContext);
  if (context === null) {
    throw new Error("useTracer must be used within a TracerProvider");
  }
  return context;
};
