import { cleanRow } from "./clean.js";

export async function loadDataset(csvPath) {
  const raw = await d3.csv(csvPath);
  const cleaned = raw.map(cleanRow);
  return cleaned;
}
