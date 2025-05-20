import fs from "node:fs";
import { Bench, type TaskResult } from "tinybench";
import { describe, it } from "vitest";

import { BENCHMARKS, type SharedArgs } from "@test/bench/benchmarks.js";
import { BENCH_CONFIG } from "@test/bench/config.js";
import { ACCOUNTS } from "@test/constants.js";
import { getClient } from "@test/utils.js";
import { traceState } from "@/index.js";

const { caller } = ACCOUNTS;

describe("Benchmark", () => {
  it("run all benchmarks", async () => {
    console.log("Running benchmarks...");
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const outputDir = `./test/bench/output/${timestamp}`;
    fs.mkdirSync(outputDir, { recursive: true });

    for (const [suiteName, benchmarkTaskConfigs] of Object.entries(BENCHMARKS)) {
      console.log(`Running ${suiteName} suite...`);

      const suiteResults: TaskResult[] = [];

      for (let i = 0; i < benchmarkTaskConfigs.length; i++) {
        const benchmarkTaskConfig = benchmarkTaskConfigs[i];
        const taskBench = new Bench({ name: `${suiteName} task ${i}`, ...BENCH_CONFIG });
        let args: SharedArgs = {};

        taskBench.add(
          `${suiteName} task ${i}`,
          async () => {
            const client = getClient();
            console.log(`${suiteName}: task ${i + 1} / ${benchmarkTaskConfigs.length} - benchmark`);
            if (typeof benchmarkTaskConfig.bench === "function") {
              await benchmarkTaskConfig.bench(client, args);
            } else {
              await traceState({ ...benchmarkTaskConfig.bench, client, from: caller.toString() });
            }
          },
          {
            beforeEach: async () => {
              const client = getClient();
              args = {};

              if (benchmarkTaskConfig.pre && Array.isArray(benchmarkTaskConfig.pre)) {
                for (let j = 0; j < benchmarkTaskConfig.pre.length; j++) {
                  console.log(
                    `${suiteName}: task ${i + 1} / ${benchmarkTaskConfigs.length} - pre-requisite ${j + 1}/${benchmarkTaskConfig.pre.length}`,
                  );
                  await client.tevmContract({
                    ...benchmarkTaskConfig.pre[j],
                    from: caller.toString(),
                    addToBlockchain: true,
                  });
                }
              } else if (benchmarkTaskConfig.pre) {
                console.log(`${suiteName}: task ${i + 1} / ${benchmarkTaskConfigs.length} - pre-requisite 1/1`);
                args = await benchmarkTaskConfig.pre(client);
              }
            },
          },
        );

        await taskBench.run();
        if (taskBench.results[0]) {
          suiteResults.push(taskBench.results[0]);
        }
        console.log(`Finished ${suiteName} task ${i + 1}`);
      }

      fs.writeFileSync(`${outputDir}/${suiteName}.json`, JSON.stringify(suiteResults, null, 2));
      console.log(`Wrote ${suiteName} suite results to ${outputDir}/${suiteName}.json`);
    }
  });
});
