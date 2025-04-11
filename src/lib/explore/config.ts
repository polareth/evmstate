/** Default exploration limit per mapping to prevent excessive computation */
const DEFAULT_MAPPING_EXPLORATION_LIMIT = 1_000_000;

/** Maximum nesting depth for mappings to prevent excessive recursion and memory usage */
const DEFAULT_MAX_MAPPING_DEPTH = 5;

/** Early pruning threshold - stop processing keys if we've found this many matches */
const DEFAULT_EARLY_TERMINATION_THRESHOLD = 500;

export interface ExploreStorageConfig {
  /**
   * Optional exploration limit for mapping combinations per mapping.
   *
   * Set to `-1` to disable early termination.
   *
   * Default {@link DEFAULT_MAPPING_EXPLORATION_LIMIT}
   */
  mappingExplorationLimit?: number;
  /**
   * Optional maximum nesting depth for mappings to prevent excessive recursion and memory usage.
   *
   * Set to `-1` to disable early termination.
   *
   * Default {@link DEFAULT_MAX_MAPPING_DEPTH}
   */
  maxMappingDepth?: number;
  /**
   * Optional early termination threshold - stop processing keys if we've found this many matches.
   *
   * Set to `-1` to disable early termination.
   *
   * Default {@link DEFAULT_EARLY_TERMINATION_THRESHOLD}
   */
  earlyTerminationThreshold?: number;
}

export const parseConfig = (config?: ExploreStorageConfig): Required<ExploreStorageConfig> => {
  return {
    mappingExplorationLimit:
      config?.mappingExplorationLimit === -1
        ? Infinity
        : (config?.mappingExplorationLimit ?? DEFAULT_MAPPING_EXPLORATION_LIMIT),
    maxMappingDepth: config?.maxMappingDepth === -1 ? Infinity : (config?.maxMappingDepth ?? DEFAULT_MAX_MAPPING_DEPTH),
    earlyTerminationThreshold:
      config?.earlyTerminationThreshold === -1
        ? Infinity
        : (config?.earlyTerminationThreshold ?? DEFAULT_EARLY_TERMINATION_THRESHOLD),
  };
};
