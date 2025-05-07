import { PathSegmentKind, watchState, type StateChange } from "@polareth/evmstate";

import { abi } from "~/snippets/abi.js";
import { client } from "~/snippets/client.js";
import { layout } from "~/snippets/layout.js";

// [!region watchState]
const unsubscribe = await watchState({
  rpcUrl: "https://1.rpc.thirdweb.com", // this or a Tevm client
  address: "0xContractAddress",
  // both storageLayout and abi are optional,
  // but providing them will avoid having to fetch
  storageLayout: layout, // this will type the state changes
  abi: abi,
  onStateChange: (stateChange) => {
    const trace = stateChange.storage?.balances.trace[0];
    if (trace?.modified) {
      console.log(`previous balance: ${trace.current?.decoded}`);
      console.log(`new balance: ${trace.next?.decoded}`);
      console.log(`mapping key: ${trace.path[0].key}`);
      console.log(`full expression: ${trace.fullExpression}`);
    }
  },
  onError: (err) => console.log(err),
  // ... same explorer options as traceState
});

// ...

unsubscribe();
// [!endregion watchState]

// [!region watchState-logs-onStateChange]
export const onStateChange = ({ storage, balance, nonce, code, txHash }: StateChange<typeof layout>) => {
  const { balances, allowances, purchases, userInfo } = storage ?? {};
  console.log(`New transaction accessing contract state: ${txHash}`);
  console.log("Contract state modified:", {
    balance: balance?.modified ?? false,
    nonce: nonce?.modified ?? false,
    code: code?.modified ?? false,
  });

  // If balances was accessed
  if (balances) {
    console.log(`Variable balances of type ${balances.type} was accessed.`);
    // for each accessed value
    balances.trace.forEach((trace) => {
      if (trace.modified) {
        console.log(
          `Balance for address ${trace.path[0].key} was modified from ${trace.current?.decoded} to ${trace.next?.decoded}`,
        );
      } else {
        console.log(`Balance for address ${trace.path[0].key} was read: ${trace.current?.decoded}`);
      }
    });
  }

  if (allowances) {
    console.log(`Variable allowances of type ${allowances.type} was accessed.`);

    allowances.trace.forEach((trace) => {
      if (trace.modified) {
        console.log(
          `Allowance of ${trace.path[1].key} for owner ${trace.path[0].key} was modified from ${trace.current?.decoded} to ${trace.next?.decoded}`,
        );
      } else {
        console.log(
          `Allowance of ${trace.path[1].key} for owner ${trace.path[0].key} was read: ${trace.current?.decoded}`,
        );
      }
    });
  }

  if (purchases) {
    console.log(`Variable purchases of type ${purchases.type} was accessed.`);
    purchases.trace.forEach((trace) => {
      // Arrays will output a special trace for their length, then one or multiple traces for each index accessed
      // Here we don't want to process length traces as we'll rather them to examine the actual array access
      if (trace.path[1].kind === PathSegmentKind.ArrayLength) return;
      // this is exactly the same:
      if (trace.fullExpression.endsWith("._length")) return;

      const userId = trace.path[0].key;
      const lengthTrace = purchases.trace.find((t) => t.path[0].key === userId);
      // same here:
      // @ts-ignore - '_lengthTrace' is declared but its value is never read.
      const _lengthTrace = purchases.trace.find((t) => t.fullExpression === `purchases[${userId}]._length`);

      if (trace.modified) {
        const currentLength = lengthTrace?.current?.decoded ?? 0n;
        const nextLength = lengthTrace?.next?.decoded ?? 0n;
        if (currentLength > nextLength) console.log(`New purchase for user id ${userId}: ${trace.next?.decoded}`);
        if (currentLength < nextLength)
          console.log(`Deleted purchase for user id ${userId}: ${trace.current?.decoded}`);
        if (currentLength === nextLength)
          console.log(`Modified purchase for user id ${userId}: ${trace.current?.decoded} -> ${trace.next?.decoded}`);
      } else {
        console.log(
          `Purchases for user id ${userId} was read at index ${trace.path[1].index}: ${trace.current?.decoded}`,
        );
      }
    });
  }

  if (userInfo) {
    console.log(`Variable userInfo of type ${userInfo.type} was accessed.`);

    userInfo.trace.forEach((trace) => {
      if (trace.modified) {
        console.log(
          `Field ${trace.path[1].name} of user ${trace.path[0].key} was modified from ${trace.current?.decoded} to ${trace.next?.decoded}`,
        );
      } else {
        console.log(`Field ${trace.path[1].name} of user ${trace.path[0].key} was read: ${trace.current?.decoded}`);
      }
    });
  }

  console.log(
    "All slots accessed:",
    Object.fromEntries(
      Object.values(storage ?? {})
        .flatMap(({ trace }) => trace.map((t) => ({ expression: t.fullExpression, slots: t.slots })))
        .map(({ expression, slots }) => [expression, slots]),
    ),
  );
};
// [!endregion watchState-logs-onStateChange]

// @ts-expect-error - unsubscribe2 is declared but its value is never read.
// [!region watchState-logs-subscribe]
const unsubscribe2 = await watchState({
  client,
  address: "0xContractAddress",
  storageLayout: layout,
  abi: abi,
  onStateChange,
});
// [!endregion watchState-logs-subscribe]
