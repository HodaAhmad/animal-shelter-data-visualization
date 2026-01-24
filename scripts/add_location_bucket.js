import fs from "node:fs";
import path from "node:path";

const INPUT = path.join("data", "final.csv");
const OUTPUT = path.join("data", "final_with_locations.csv");

function normalizeLocation(row) {
  const key = (row.loc_key || "").trim();
  if (key) return key;

  let s = String(row.found_location || "").toLowerCase().trim();

  //drop TX suffix variants
  s = s.replace(/\s*\(tx\)\s*$/i, "");
  s = s.replace(/\s*,?\s*tx\s*$/i, "");

  //normalize intersection separators
  s = s.replace(/\s+and\s+/g, " & ");
  s = s.replace(/\s*@\s*/g, " & ");
  s = s.replace(/\s*\/\s*/g, " & ");
  s = s.replace(/\s*&\s*/g, " & ");

  //normalize common road tokens 
  s = s.replace(/\bih\b/g, "i-");
  s = s.replace(/\bi\s*-\s*/g, "i-");
  s = s.replace(/\bhighway\b/g, "hwy");
  s = s.replace(/\bstreet\b/g, "st");
  s = s.replace(/\bavenue\b/g, "ave");
  s = s.replace(/\broad\b/g, "rd");
  s = s.replace(/\bboulevard\b/g, "blvd");
  s = s.replace(/\bdrive\b/g, "dr");
  s = s.replace(/\blane\b/g, "ln");

  //collapse whitespace
  s = s.replace(/\s+/g, " ").trim();

  return s || "unknown";
}

function locationLevel(bucket) {
  if (!bucket || bucket === "unknown") return "unknown";
  if (bucket.includes("&")) return "intersection";
  if (/\d/.test(bucket)) return "address";
  return "area";
}

function parseCSV(text) {
  const lines = text.split(/\r?\n/).filter(Boolean);
  const header = splitCSVLine(lines[0]);
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const vals = splitCSVLine(lines[i]);
    const obj = {};
    header.forEach((h, j) => (obj[h] = vals[j] ?? ""));
    rows.push(obj);
  }
  return { header, rows };
}

function splitCSVLine(line) {
  const out = [];
  let cur = "";
  let inQ = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQ && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQ = !inQ;
      }
    } else if (ch === "," && !inQ) {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

function csvEscape(val) {
  const s = String(val ?? "");
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function writeCSV(header, rows) {
  const lines = [];
  lines.push(header.map(csvEscape).join(","));
  for (const r of rows) {
    lines.push(header.map(h => csvEscape(r[h])).join(","));
  }
  return lines.join("\n");
}

const raw = fs.readFileSync(INPUT, "utf8");
const { header, rows } = parseCSV(raw);

//add new columns
const NEW_COLS = ["location_bucket", "location_level"];
for (const c of NEW_COLS) {
  if (!header.includes(c)) header.push(c);
}

for (const r of rows) {
  const bucket = normalizeLocation(r);
  r.location_bucket = bucket;
  r.location_level = locationLevel(bucket);
}

fs.writeFileSync(OUTPUT, writeCSV(header, rows), "utf8");

console.log(`Wrote ${OUTPUT}`);
console.log(`Rows: ${rows.length}`);
