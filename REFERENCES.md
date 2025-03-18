# References

## Notes

- pass some tx arguments, same but run with tevm directly and return access list (+ maybe some other execution info if opted-in to bonus info)
- (additional) pass some tx hash and return listed storage slot changes by this tx (get tx, fork before, dump state, run tx with tevm, dump state, compare)

- provide provider
- provide from address to impersonate
- maybe return two objects: "read" and "write" so we can include labeled slots that got only read as well

1. Run tx and see affected accounts
2. Backward fork, dump storage of these accounts
3. Run tx with tevm, dump storage of these accounts
4. Compare for each and interpret

## Listen to steps during call

This might be useful for listening to EVM steps and maybe grab all storage updates accurately

```ts
import { createMemoryClient } from "tevm";
import { encodeFunctionData } from "viem";

const client = createMemoryClient();

// Listen for EVM steps and other events during execution
const result = await client.tevmCall({
  to: contractAddress,
  data: encodeFunctionData({
    abi,
    functionName: "myFunction",
    args: [arg1, arg2],
  }),
  // Listen for EVM steps
  onStep: (step, next) => {
    console.log("EVM Step:", {
      pc: step.pc, // Program counter
      opcode: step.opcode, // Current opcode
      gasLeft: step.gasLeft, // Remaining gas
      stack: step.stack, // Stack contents
      depth: step.depth, // Call depth
    });
    next?.();
  },
  // Listen for contract creation
  onNewContract: (data, next) => {
    console.log("New contract deployed:", {
      address: data.address.toString(),
      codeSize: data.code.length,
    });
    next?.();
  },
  // Listen for message execution
  onBeforeMessage: (message, next) => {
    console.log("Executing message:", {
      to: message.to?.toString(),
      value: message.value.toString(),
      delegatecall: message.delegatecall,
    });
    next?.();
  },
  onAfterMessage: (result, next) => {
    console.log("Message result:", {
      gasUsed: result.execResult.executionGasUsed.toString(),
      returnValue: result.execResult.returnValue.toString("hex"),
      error: result.execResult.exceptionError?.error,
    });
    next?.();
  },
});
```
