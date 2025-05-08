import { generateStorageLayouts } from "./generate-storage-layouts.js";
import { generateThemesDocs } from "./generate-themes-docs.js";

const prepare = async () => {
  await generateThemesDocs();
  await generateStorageLayouts();
};

prepare();
