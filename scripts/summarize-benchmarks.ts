import fs from "node:fs";
import path from "node:path";
import type { TaskResult } from "tinybench";

const OUTPUT_DIR = path.resolve(import.meta.dirname, "../test/bench/output");
const SUMMARY_FILE = path.resolve(import.meta.dirname, "../BENCHMARKS.md");
const SUMMARY_LOG_FILE = path.resolve(OUTPUT_DIR, "summary_log.json");

// Raw results per suite (file)
interface SuiteRawResults {
  [suiteName: string]: TaskResult[];
}

// Aggregated metrics for a single suite
interface AggregatedSuiteMetrics {
  avgHz: number;
  minHz: number;
  maxHz: number;
  avgMean: number; // in seconds
  minMean: number; // in seconds
  maxMean: number; // in seconds
  taskCount: number;
  suiteName: string; // Keep track of the original suite name
}

// All aggregated results for a run
interface AllSuiteAggregatedResults {
  [suiteName: string]: AggregatedSuiteMetrics;
}

// --- File System Utilities ---

/** Gets a list of all timestamped run directories sorted from oldest to newest. */
function getRunDirectories(): string[] {
  if (!fs.existsSync(OUTPUT_DIR)) {
    console.warn(`Output directory ${OUTPUT_DIR} does not exist. No benchmarks to summarize.`);
    return [];
  }
  const entries = fs.readdirSync(OUTPUT_DIR, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

/** Reads and parses all JSON benchmark files in a given run directory. */
function readBenchmarkFiles(runDirName: string): SuiteRawResults {
  const fullRunPath = path.join(OUTPUT_DIR, runDirName);
  const results: SuiteRawResults = {};
  if (!fs.existsSync(fullRunPath)) return results;

  const files = fs.readdirSync(fullRunPath);
  for (const file of files) {
    if (file.endsWith(".json") && file !== path.basename(SUMMARY_LOG_FILE)) {
      const suiteName = file.replace(".json", "");
      try {
        const filePath = path.join(fullRunPath, file);
        const content = fs.readFileSync(filePath, "utf-8");
        // The content of each JSON file is an array of TaskResult
        results[suiteName] = JSON.parse(content) as TaskResult[];
      } catch (error) {
        console.error(`Error reading or parsing ${path.join(runDirName, file)}:`, error);
      }
    }
  }
  return results;
}

/** Reads the log of already summarized directories. */
function getSummarizedRuns(): string[] {
  if (!fs.existsSync(SUMMARY_LOG_FILE)) {
    return [];
  }
  try {
    const content = fs.readFileSync(SUMMARY_LOG_FILE, "utf-8");
    return JSON.parse(content) as string[];
  } catch (error) {
    console.error(`Error reading summary log ${SUMMARY_LOG_FILE}:`, error);
    return [];
  }
}

/** Appends a run directory to the log of summarized directories. */
function addRunToSummaryLog(runDirName: string): void {
  const summarizedRuns = getSummarizedRuns();
  if (!summarizedRuns.includes(runDirName)) {
    summarizedRuns.push(runDirName);
    try {
      fs.mkdirSync(OUTPUT_DIR, { recursive: true });
      fs.writeFileSync(SUMMARY_LOG_FILE, JSON.stringify(summarizedRuns, null, 2));
    } catch (error) {
      console.error(`Error writing to summary log ${SUMMARY_LOG_FILE}:`, error);
    }
  }
}

// --- Aggregation Logic ---

/** Calculates aggregate metrics (min, max, avg) for each benchmark suite. */
function aggregateSuiteResults(rawResults: SuiteRawResults): AllSuiteAggregatedResults {
  const aggregated: AllSuiteAggregatedResults = {};
  for (const suiteName in rawResults) {
    const tasks = rawResults[suiteName];
    if (!tasks || tasks.length === 0) {
      // Represent suites with no tasks or errors during parse with 0/NaN values
      // to prevent crashes later, but indicate they are empty.
      aggregated[suiteName] = {
        suiteName,
        avgHz: 0,
        minHz: 0,
        maxHz: 0,
        avgMean: 0,
        minMean: 0,
        maxMean: 0,
        taskCount: 0,
      };
      continue;
    }

    let totalHz = 0,
      totalMean = 0;
    let minHz = Infinity,
      maxHz = -Infinity;
    let minMean = Infinity,
      maxMean = -Infinity;

    tasks.forEach((task) => {
      totalHz += task.throughput.mean;
      totalMean += task.latency.mean;
      if (task.throughput.mean < minHz) minHz = task.throughput.mean;
      if (task.throughput.mean > maxHz) maxHz = task.throughput.mean;
      if (task.latency.mean < minMean) minMean = task.latency.mean;
      if (task.latency.mean > maxMean) maxMean = task.latency.mean;
    });

    const taskCount = tasks.length;
    aggregated[suiteName] = {
      suiteName,
      avgHz: totalHz / taskCount,
      minHz,
      maxHz,
      avgMean: totalMean / taskCount,
      minMean,
      maxMean,
      taskCount,
    };
  }
  return aggregated;
}

// --- Summary Generation ---

function formatNumber(num: number, precision = 2): string {
  if (isNaN(num) || !isFinite(num)) return "N/A";
  return num.toFixed(precision);
}

function formatTime(seconds: number): string {
  if (isNaN(seconds) || !isFinite(seconds)) return "N/A";
  if (seconds < 0.001) return `${formatNumber(seconds * 1_000_000, 0)} µs`; // Microseconds
  if (seconds < 1) return `${formatNumber(seconds * 1000, 2)} ms`; // Milliseconds
  return `${formatNumber(seconds, 2)} s`; // Seconds
}

function generateComparison(latest: AggregatedSuiteMetrics, prev: AggregatedSuiteMetrics): string {
  const opsChange =
    prev.avgHz !== 0 ? ((latest.avgHz - prev.avgHz) / prev.avgHz) * 100 : latest.avgHz > 0 ? Infinity : 0;
  const timeChange =
    prev.avgMean !== 0 ? ((latest.avgMean - prev.avgMean) / prev.avgMean) * 100 : latest.avgMean > 0 ? Infinity : 0;

  let comparison = `Avg Ops/sec: ${formatNumber(latest.avgHz)} (vs ${formatNumber(prev.avgHz)}, ${opsChange >= 0 ? "+" : ""}${formatNumber(opsChange)}%) | `;
  comparison += `Avg Time: ${formatTime(latest.avgMean)} (vs ${formatTime(prev.avgMean)}, ${timeChange >= 0 ? "+" : ""}${formatNumber(timeChange)}%)\n`;
  comparison += `  - Ops/sec Range: ${formatNumber(latest.minHz)} - ${formatNumber(latest.maxHz)}\n`;
  comparison += `  - Time Range: ${formatTime(latest.minMean)} - ${formatTime(latest.maxMean)}`;
  return comparison;
}

function generateMarkdownSummary(
  latestRunDir: string,
  latestResults: AllSuiteAggregatedResults,
  prevRunDir?: string,
  prevResults?: AllSuiteAggregatedResults,
): string {
  let md = `## Benchmark Summary: ${latestRunDir}\n\n`;
  if (prevRunDir && prevResults) {
    md += `Comparing with: ${prevRunDir}\n\n`;
  }

  const sortedSuiteNames = Object.keys(latestResults).sort();

  for (const suiteName of sortedSuiteNames) {
    md += `### Suite: ${suiteName}\n`;
    const suiteData = latestResults[suiteName];

    if (suiteData.taskCount === 0) {
      md += "- No benchmark tasks found or data was invalid.\n\n";
      continue;
    }

    md += `- Tasks: ${suiteData.taskCount}\n`;

    const prevSuiteData = prevResults?.[suiteName];
    if (prevSuiteData && prevSuiteData.taskCount > 0) {
      md += `${generateComparison(suiteData, prevSuiteData)}\n`;
    } else {
      md += `- Avg Ops/sec: ${formatNumber(suiteData.avgHz)}\n`;
      md += `- Avg Time: ${formatTime(suiteData.avgMean)}\n`;
      md += `- Ops/sec Range: ${formatNumber(suiteData.minHz)} - ${formatNumber(suiteData.maxHz)}\n`;
      md += `- Time Range: ${formatTime(suiteData.minMean)} - ${formatTime(suiteData.maxMean)}\n`;
    }
    md += `\n`;
  }
  return md;
}

// --- Main Script Logic ---

function main() {
  const runDirectories = getRunDirectories();
  if (runDirectories.length === 0) {
    console.log("No benchmark runs found in output directory.");
    return;
  }

  const latestRunDir = runDirectories[runDirectories.length - 1];
  const summarizedRuns = getSummarizedRuns();

  if (summarizedRuns.includes(latestRunDir) && process.argv.indexOf("--force") === -1) {
    console.log(`Latest run ${latestRunDir} has already been summarized. Use --force to re-summarize.`);
    return;
  }

  console.log(`Summarizing latest run: ${latestRunDir}`);
  const latestRawResults = readBenchmarkFiles(latestRunDir);
  if (Object.keys(latestRawResults).length === 0) {
    console.error(`No benchmark result files found in ${latestRunDir}.`);
    return;
  }
  const latestAggregatedResults = aggregateSuiteResults(latestRawResults);

  let prevRunDir: string | undefined;
  let prevAggregatedResults: AllSuiteAggregatedResults | undefined;

  const latestRunIndex = runDirectories.indexOf(latestRunDir);
  if (latestRunIndex > 0) {
    prevRunDir = runDirectories[latestRunIndex - 1];
  }

  if (prevRunDir) {
    console.log(`Comparing with previous run: ${prevRunDir}`);
    const prevRawResults = readBenchmarkFiles(prevRunDir);
    if (Object.keys(prevRawResults).length === 0) {
      console.warn(
        `No benchmark result files found in previous run directory ${prevRunDir}. Comparison will be limited.`,
      );
    } else {
      prevAggregatedResults = aggregateSuiteResults(prevRawResults);
    }
  }

  const summaryMarkdown = generateMarkdownSummary(
    latestRunDir,
    latestAggregatedResults,
    prevRunDir,
    prevAggregatedResults,
  );

  let existingSummary = "";
  if (fs.existsSync(SUMMARY_FILE)) {
    existingSummary = fs.readFileSync(SUMMARY_FILE, "utf-8");
  }

  const newSummaryContent = summaryMarkdown + "\n---\n\n" + existingSummary;
  try {
    fs.writeFileSync(SUMMARY_FILE, newSummaryContent);
    console.log(`Benchmark summary updated in ${SUMMARY_FILE}`);
  } catch (error) {
    console.error(`Error writing summary file ${SUMMARY_FILE}:`, error);
    return;
  }

  addRunToSummaryLog(latestRunDir);
  console.log(`${latestRunDir} marked as summarized.`);
}

main();
