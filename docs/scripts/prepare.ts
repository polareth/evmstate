import fs from "node:fs/promises";
import path from "node:path";

/** Fetches a JSON file from a URL and writes it to a local file. */
const fetchAndWriteTheme = async () => {
  const themeJsonUrl =
    "https://raw.githubusercontent.com/0xpolarzero/poimandres-light-theme-vscode/refs/heads/main/themes/poimandres-light-color-theme.json";
  const themeJsonOutput = "docs/themes/theme-light.json";

  console.log(`Fetching theme from: ${themeJsonUrl}`);
  try {
    const response = await fetch(themeJsonUrl);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

    const themeData = await response.json();
    const themeJsonString = JSON.stringify(themeData, null, 2);

    const outputDir = path.dirname(themeJsonOutput);
    await fs.mkdir(outputDir, { recursive: true });
    await fs.writeFile(themeJsonOutput, themeJsonString, "utf8");

    console.log(`Successfully wrote theme to: ${themeJsonOutput}`);
  } catch (error) {
    console.error(`Error fetching or writing theme: ${error}`);
    process.exit(1);
  }
};

fetchAndWriteTheme();
