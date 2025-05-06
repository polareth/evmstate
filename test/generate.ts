import fs from "node:fs";
import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { createCache } from "@tevm/bundler-cache";
import { type FileAccessObject } from "tevm/bundler";
import { type ResolvedCompilerConfig } from "tevm/bundler/config";

import { createSolc, type SolcStorageLayout } from "@/lib/solc.js";
import { logger } from "@/logger.js";

// Get the equivalent of __dirname in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Setup file access and cache similar to setup.ts
const config = JSON.parse(fs.readFileSync(join(__dirname, "../tevm.config.json"), "utf8")) as ResolvedCompilerConfig;
const fileAccess: FileAccessObject = {
  writeFileSync: fs.writeFileSync,
  writeFile,
  readFile: (path, encoding) => fs.promises.readFile(path, { encoding }),
  readFileSync: fs.readFileSync,
  exists: async (path) => !!(await fs.promises.stat(path).catch(() => false)),
  existsSync: fs.existsSync,
  statSync: fs.statSync,
  stat,
  mkdirSync: fs.mkdirSync,
  mkdir,
};

const cache = createCache(config.cacheDir, fileAccess, process.cwd());

export const generateStorageLayouts = async () => {
  // Create output directory if it doesn't exist
  const outputDir = join(__dirname, "generated/layouts");
  await mkdir(outputDir, { recursive: true });

  // Get the contracts directory
  const contractsDir = join(process.cwd(), ".tevm/test/contracts");

  // Find all artifacts.json files recursively
  const artifactFiles = await findArtifactFiles(contractsDir);

  // Keep track of all generated contract names for the index file
  const generatedContracts: string[] = [];

  for (const artifactFile of artifactFiles) {
    try {
      const dirPath = dirname(artifactFile);
      const relativePath = dirPath.replace(process.cwd() + "/", "");

      logger.log(`Processing artifact: ${relativePath}`);

      // Read and parse the artifact file
      const artifactContent = await readFile(artifactFile, "utf8");
      const artifact = JSON.parse(artifactContent);

      // Get all contract names from the artifact
      const contractNames = Object.keys(artifact.artifacts || {});

      if (contractNames.length === 0) {
        logger.error(`No contracts found in artifact: ${artifactFile}`);
        continue;
      }

      logger.log(`Found ${contractNames.length} contracts in artifact: ${artifactFile}`);

      // Try to read from cache first
      const artifacts = cache.readArtifactsSync(relativePath);

      // Process each contract in the artifact
      for (const contractName of contractNames) {
        logger.log(`Processing contract: ${contractName}`);

        let storageLayout: SolcStorageLayout | undefined;

        // Check if we already have the storage layout in the cache
        if (artifacts?.solcOutput?.contracts) {
          for (const sourcePath in artifacts.solcOutput.contracts) {
            const sourceContracts = artifacts.solcOutput.contracts[sourcePath];
            if (sourceContracts[contractName]?.storageLayout) {
              storageLayout = sourceContracts[contractName].storageLayout as unknown as SolcStorageLayout;
              break;
            }
          }
        }

        // If not found in cache, generate it
        if (!storageLayout) {
          const solcInput = artifact.solcInput;
          const solc = await createSolc("0.8.23");

          const output = solc.compile({
            language: solcInput?.language ?? "Solidity",
            settings: {
              evmVersion: solcInput?.settings?.evmVersion ?? "paris",
              outputSelection: {
                "*": {
                  "*": ["storageLayout"],
                },
              },
            },
            sources: solcInput?.sources ?? {},
          });

          if (output.errors?.some((error) => error.severity === "error")) {
            logger.error(`Compilation errors for ${contractName}:`, output.errors);
            continue;
          }

          // Find the contract in the output
          for (const sourcePath in output.contracts) {
            if (output.contracts[sourcePath][contractName]) {
              storageLayout = output.contracts[sourcePath][contractName].storageLayout as unknown as SolcStorageLayout;
              break;
            }
          }

          // Update cache with the new storage layout
          if (storageLayout && artifacts) {
            // Find the source path for this contract
            const sourcePath = Object.keys(output.contracts).find((path) => output.contracts[path][contractName]);

            if (sourcePath) {
              cache.writeArtifactsSync(relativePath, {
                ...artifacts,
                // @ts-ignore
                solcOutput: {
                  ...artifacts.solcOutput,
                  // @ts-expect-error abi undefined
                  contracts: {
                    ...artifacts.solcOutput?.contracts,
                    [sourcePath]: {
                      ...artifacts.solcOutput?.contracts?.[sourcePath],
                      [contractName]: {
                        ...artifacts.solcOutput?.contracts?.[sourcePath]?.[contractName],
                        storageLayout,
                      },
                    },
                  },
                },
              });
            }
          }
        }

        if (!storageLayout) {
          logger.error(`No storage layout generated for ${contractName}`);
          continue;
        }

        // Generate output file
        const outputPath = join(outputDir, `${contractName}.ts`);
        const outputContent = `// Generated storage layout for ${contractName}
export default ${JSON.stringify(storageLayout, null, 2)} as const;
`;

        fs.writeFileSync(outputPath, outputContent);
        logger.log(`Generated storage layout for ${contractName} at ${outputPath}`);

        // Add to the list of generated contracts
        generatedContracts.push(contractName);
      }
    } catch (error) {
      logger.error(`Error processing artifact:`, error);
    }
  }

  // Generate the index file
  if (generatedContracts.length > 0) {
    const indexPath = join(outputDir, "index.ts");
    const indexContent =
      generatedContracts.map((name) => `export { default as ${name} } from "./${name}";`).join("\n") + "\n";

    fs.writeFileSync(indexPath, indexContent);
    logger.log(`Generated index file with ${generatedContracts.length} layouts`);
  }
};

// Helper function to find all artifacts.json files recursively
async function findArtifactFiles(dir: string): Promise<string[]> {
  const files = await readdir(dir, { withFileTypes: true });
  const artifactFiles: string[] = [];

  for (const file of files) {
    const path = join(dir, file.name);

    if (file.isDirectory()) {
      artifactFiles.push(...(await findArtifactFiles(path)));
    } else if (file.name === "artifacts.json") {
      artifactFiles.push(path);
    }
  }

  return artifactFiles;
}

generateStorageLayouts()
  .then(() => {
    console.log("done");
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
