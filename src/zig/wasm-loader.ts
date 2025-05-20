import fs from "node:fs/promises"; // Using promises for async file reading
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Determine the directory of the current module
const __dirname = dirname(fileURLToPath(import.meta.url));
// Resolve the path to the WASM file, assuming this loader is in src/lib
// and the wasm file is in dist/wasm/
const wasmPath = resolve(__dirname, "../../dist/wasm/evmstate.wasm");

/** Represents the exports from our WASM module. Update this interface as you add more exported functions from Zig. */
interface EvmStateWasmExports extends WebAssembly.Exports {
  memory: WebAssembly.Memory;
  add: (a: number, b: number) => number;
  // Add other exported Zig functions here, e.g.:
  // keccak256: (input_ptr: number, input_len: number, output_ptr: number) => void;
}

/** Type for the instantiated WASM instance, providing type safety. */
interface EvmStateWasmInstance extends WebAssembly.Instance {
  exports: EvmStateWasmExports;
}

let wasmInstance: EvmStateWasmInstance | null = null;

/**
 * Initializes the WebAssembly module. Reads the WASM file, instantiates it, and caches the instance.
 *
 * @returns {Promise<EvmStateWasmInstance>} The WebAssembly instance with typed exports.
 * @throws {Error} If the WASM file cannot be read or instantiation fails.
 */
export const initWasm = async (): Promise<EvmStateWasmInstance> => {
  if (wasmInstance) return wasmInstance;

  try {
    const wasmBuffer = await fs.readFile(wasmPath);
    const { instance } = await WebAssembly.instantiate(wasmBuffer, {
      // Imports can be provided here if your WASM module needs them
      // e.g., env: { your_import_function: () => {} }
    });

    console.log("EVMState WASM module initialized successfully.");
    console.log("WASM exports:", Object.keys(instance.exports));

    wasmInstance = instance as EvmStateWasmInstance;
    return wasmInstance;
  } catch (err) {
    console.error("Error loading EVMState WASM module:", err);
    // Depending on your error handling strategy, you might want to throw a custom error
    // or handle it differently.
    throw new Error(`Failed to initialize EVMState WASM: ${err instanceof Error ? err.message : String(err)}`);
  }
};

/**
 * Gets the initialized WASM instance. Throws an error if `initWasm` has not been called successfully first.
 *
 * @returns {EvmStateWasmInstance} The WebAssembly instance.
 */
export function getWasmInstance(): EvmStateWasmInstance {
  if (!wasmInstance) {
    throw new Error("WASM module not initialized. Call initWasm() first.");
  }
  return wasmInstance;
}

// Example usage (can be removed or adapted for your library's entry point):
// (async () => {
//   try {
//     const instance = await initWasm();
//     const result = instance.exports.add(5, 7);
//     console.log('Result of add(5, 7) from WASM:', result); // Should output 12
//   } catch (error) {
//     console.error('Failed to run WASM example:', error);
//   }
// })();
