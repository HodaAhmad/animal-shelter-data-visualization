import fs from "fs";
import fetch from "node-fetch";
import { csvParse, csvFormat } from "d3-dsv";

const IN_PATH = "data/locations_top.csv";
const OUT_PATH = "data/locations_geocoded.csv";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function loadCSV(path) {
  if (!fs.existsSync(path)) return [];
  return csvParse(fs.readFileSync(path, "utf8"));
}

function saveCSV(path, rows) {
  fs.writeFileSync(path, csvFormat(rows), "utf8");
}

const top = loadCSV(IN_PATH);
const cache = loadCSV(OUT_PATH);
const cacheByLoc = new Map(cache.map(d => [d.found_location, d]));

console.log("Top rows:", top.length, "Cached:", cache.length);

const SKIP_EXACT = new Set([
  "Outside Jurisdiction",
  "Unknown",
  "No Location",
]);

async function geocodeNominatim(q) {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "1");
  url.searchParams.set("q", q);

  const res = await fetch(url.toString(), {
    headers: {
      "User-Agent": "animal-shelter-data-visualization (course project)",
      "Accept-Language": "en"
    }
  });

  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  if (!json.length) return null;

  return { lat: +json[0].lat, lon: +json[0].lon };
}

function buildQuery(found_location) {
  let s = String(found_location ?? "").trim();
  if (!s || SKIP_EXACT.has(s)) return null;

  // Normalize common intersection wording
  s = s.replace(/\s+And\s+/gi, " & ");

  // If it's "X in Austin (TX)", rewrite to "X, Austin, TX"
  const m = s.match(/^(.*?)\s+in\s+(.+?)\s*\((\w{2})\)\s*$/i);
  if (m) {
    const area = m[1].trim();
    const city = m[2].trim();
    const st = m[3].trim().toUpperCase();
    return `${area}, ${city}, ${st}, USA`;
  }

  // If it already has TX, use it; otherwise bias to Texas
  const hasTX = /\bTX\b|\(TX\)|Texas/i.test(s);
  if (hasTX) return `${s}, USA`;

  return `${s}, Texas, USA`;
}


const out = [...cache];

for (let i = 0; i < top.length; i++) {
  const row = top[i];
  const loc = row.found_location;

  if (cacheByLoc.has(loc)) continue; // cached

  const query = buildQuery(loc);

  // Skip
  if (query === null) {
    const rec = { found_location: loc, n: row.n, lat: "", lon: "", status: "skip_non_geographic" };
    out.push(rec);
    cacheByLoc.set(loc, rec);
    continue;
  }

  let lat = "";
  let lon = "";
  let status = "no_result";

  try {
    const result = await geocodeNominatim(query);
    if (result) {
      lat = result.lat;
      lon = result.lon;
      status = "ok";
    }
  } catch (e) {
    status = "error";
  }

  const rec = { found_location: loc, n: row.n, lat, lon, status };
  out.push(rec);
  cacheByLoc.set(loc, rec);

  if (out.length % 50 === 0) {
    saveCSV(OUT_PATH, out);
    console.log(`Saved ${out.length}/${top.length} (last: ${loc} -> ${status})`);
  }

  // Rate limit 
  await sleep(1100);
}

saveCSV(OUT_PATH, out);
console.log("Done. Wrote:", OUT_PATH);

// Quick summary
const counts = {};
for (const r of out) counts[r.status] = (counts[r.status] ?? 0) + 1;
console.log("Status counts:", counts);
