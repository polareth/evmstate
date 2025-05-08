import type { Address } from "tevm";

import type { LabeledState } from "@/lib/trace/types.js";

/**
 * The result of a state trace.
 *
 * Custom Map implementation that normalizes addresses to lowercase with additional methods.
 */
export class TraceStateResult extends Map<Address, LabeledState> {
  /**
   * Get the labeled state for a specific address.
   *
   * Normalizes the address to lowercase before lookup.
   *
   * @param address The address to get the state for
   * @returns The labeled state for the address, or undefined if not found
   */
  override get(address: Address): LabeledState | undefined {
    return super.get(address.toLowerCase() as Address);
  }

  /**
   * Check if the map has a specific address.
   *
   * Normalizes the address to lowercase before lookup.
   *
   * @param address The address to check
   * @returns True if the address exists in the map
   */
  override has(address: Address): boolean {
    return super.has(address.toLowerCase() as Address);
  }

  /**
   * Set a labeled state for a specific address.
   *
   * Normalizes the address to lowercase before setting.
   *
   * @param address The address to set the state for
   * @param state The labeled state to set
   * @returns This map
   */
  override set(address: Address, state: LabeledState): this {
    return super.set(address.toLowerCase() as Address, state);
  }
}
