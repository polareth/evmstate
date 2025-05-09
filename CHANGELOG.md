# @polareth/evmstate

## 0.1.1

### Patch Changes

- [`2bfd145`](https://github.com/polareth/evmstate/commit/2bfd145144a6e84ec4b0402921bbaa3af4072f76) Thanks [@0xpolarzero](https://github.com/0xpolarzero)! - - More accurate and consistent naming for types (e.g. diff -> state)

  - `traceState` now returns a Map of address -> state, that is case-insensitive

    ```ts
    const trace = await traceState(...);
    const someState = trace.get("0x...");
    ```

  - Fix a bug where accessing a nested field in a mapping => struct would not be recognized if it was not in the first slot of that struct
  - Add experimental and unsupported tags, and improve reforking in `watchState`

## 0.1.0

### Minor Changes

- Initial release.
