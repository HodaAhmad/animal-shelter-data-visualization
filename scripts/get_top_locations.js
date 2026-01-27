import fs from "fs";
import { csvParse, csvFormat } from "d3-dsv";

const RAW_PATH = "data/raw.csv";
const OUT_PATH = "data/locations_top.csv";
const TOP_N = 1000;

const raw = csvParse(fs.readFileSync(RAW_PATH, "utf8"));

const norm = (v) => String(v ?? "").trim().replace(/\s+/g, " ");

const counts = new Map();
for (const r of raw) {
  const loc = norm(r.found_location);
  if (!loc) continue;
  counts.set(loc, (counts.get(loc) ?? 0) + 1);
}

const top = [...counts.entries()]
  .sort((a, b) => b[1] - a[1])
  .slice(0, TOP_N)
  .map(([found_location, n]) => ({ found_location, n }));

fs.writeFileSync(OUT_PATH, csvFormat(top), "utf8");
console.log("Total unique found_location:", counts.size);
console.log("Wrote top locations:", top.length, "to", OUT_PATH);
console.log("Sample:", top.slice(0, 5));
