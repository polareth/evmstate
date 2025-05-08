---
"@polareth/evmstate": patch
---

- More accurate and consistent naming for types (e.g. diff -> state)
- `traceState` now returns a Map of address -> state, that is case-insensitive

  ```ts
  const trace = await traceState(...);
  const someState = trace.get("0x...");
  ```

- Fix a bug where accessing a nested field in a mapping => struct would not be recognized if it was not in the first slot of that struct
- Add experimental and unsupported tags, and improve reforking in `watchState`
