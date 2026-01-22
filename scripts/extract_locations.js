import fs from "fs";
import { csvParse, csvFormat } from "d3-dsv";

const RAW_PATH = "data/raw.csv";
const OUT_PATH = "data/locations_unique.csv";

const rawText = fs.readFileSync(RAW_PATH, "utf8");
const rows = csvParse(rawText);

const norm = (v) => String(v ?? "").trim().replace(/\s+/g, " ");

function parseFoundLocation(raw) {
  const s = norm(raw);
  if (!s) {
    return {
      found_location_raw: "",
      loc_area: "Unknown",
      loc_city: "Unknown",
      loc_state: "Unknown",
      loc_key: "Unknown | Unknown Unknown",
      loc_query: ""
    };
  }

  // Pattern 1: "<area> in <city> (ST)"
  let m = s.match(/^(.*?)\s+in\s+(.+?)\s*\((\w{2})\)\s*$/i);
  if (m) {
    const loc_area = norm(m[1]);
    const loc_city = norm(m[2]);
    const loc_state = norm(m[3]).toUpperCase();
    const loc_key = `${loc_area} | ${loc_city} ${loc_state}`;
    const loc_query = `${loc_area}, ${loc_city}, ${loc_state}`;
    return { found_location_raw: s, loc_area, loc_city, loc_state, loc_key, loc_query };
  }

  // Pattern 2: "<city> (ST)"
  m = s.match(/^(.+?)\s*\((\w{2})\)\s*$/i);
  if (m) {
    const loc_city = norm(m[1]);
    const loc_state = norm(m[2]).toUpperCase();
    const loc_area = loc_city;
    const loc_key = `${loc_area} | ${loc_city} ${loc_state}`;
    const loc_query = `${loc_city}, ${loc_state}`;
    return { found_location_raw: s, loc_area, loc_city, loc_state, loc_key, loc_query };
  }

  // Fallback: keep raw as area
  const loc_area = s;
  const loc_city = "Unknown";
  const loc_state = "Unknown";
  const loc_key = `${loc_area} | ${loc_city} ${loc_state}`;
  const loc_query = s;
  return { found_location_raw: s, loc_area, loc_city, loc_state, loc_key, loc_query };
}

const map = new Map();

for (const r of rows) {
  const parsed = parseFoundLocation(r.found_location);
  if (!parsed.loc_query) continue;
  if (!map.has(parsed.loc_key)) map.set(parsed.loc_key, parsed);
}

const unique = [...map.values()];
fs.writeFileSync(OUT_PATH, csvFormat(unique), "utf8");

console.log("Raw rows:", rows.length);
console.log("Unique locations:", unique.length);
console.log("Wrote:", OUT_PATH);
console.log("Sample:", unique.slice(0, 5));
