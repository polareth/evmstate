import type { Address } from "tevm";

import { TransparentProxy } from "@test/contracts/index.js";
import { traceState } from "@/index.js";

import { client } from "~/snippets/client.js";

const admin = `0x${"1".repeat(40)}` as Address;
const implementation = `0x${"2".repeat(40)}` as Address;
const proxy = TransparentProxy.withAddress(`0x${"3".repeat(40)}`);

// [!region proxy-trace]
const trace = await traceState({
  client,
  from: admin,
  ...proxy.write.changeImplementation(implementation),
});

console.log(trace[proxy.address].storage);
// [!endregion proxy-trace]
