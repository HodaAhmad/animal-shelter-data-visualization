import fs from "fs";
import { csvParse, csvFormat } from "d3-dsv";

const RAW_PATH = "data/raw.csv";
const GEO_PATH = "data/locations_geocoded.csv";
const OUT_PATH = "data/final.csv";

const raw = csvParse(fs.readFileSync(RAW_PATH, "utf8"));
const geo = csvParse(fs.readFileSync(GEO_PATH, "utf8"));

const norm = (v) => String(v ?? "").trim().replace(/\s+/g, " ");

const geoByLoc = new Map(geo.map(d => [norm(d.found_location), d]));

let withCoords = 0;

const joined = raw.map(r => {
  const loc = norm(r.found_location);
  const g = geoByLoc.get(loc);

  const lat = g?.lat ?? "";
  const lon = g?.lon ?? "";
  const geo_status = g?.status ?? "not_in_top1000";

  if (lat && lon) withCoords++;

  return { ...r, lat, lon, geo_status };
});

fs.writeFileSync(OUT_PATH, csvFormat(joined), "utf8");

// QA
const statusCounts = {};
for (const r of joined) statusCounts[r.geo_status] = (statusCounts[r.geo_status] ?? 0) + 1;
console.log("Rows:", joined.length);
console.log("Rows with coords:", withCoords);
console.log("geo_status counts:", statusCounts);

const okRows = joined.filter(d => d.geo_status === "ok");
const outOfBounds = okRows.filter(d => {
  const lat = +d.lat, lon = +d.lon;
  return !(lat >= 25 && lat <= 37 && lon >= -107 && lon <= -93);
});
console.log("Out-of-bounds OK rows:", outOfBounds.length);
console.table(outOfBounds.slice(0, 10));

console.log("Wrote:", OUT_PATH);
