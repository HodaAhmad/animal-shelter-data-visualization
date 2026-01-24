function norm(v) {
  if (v == null) return "Unknown";
  const s = String(v).trim().replace(/\s+/g, " ");
  return s.length ? s : "Unknown";
}

function num(v) {
  const x = +v;
  return Number.isFinite(x) ? x : null;
}

// parse found location
function parseFoundLocation(raw) {
  const s = norm(raw);

  let loc_area = "Unknown";
  let loc_city = "Unknown";
  let loc_state = "Unknown";

  // Pattern 1: "<area> in <city> (ST)"
  const m1 = s.match(/^(.*?)\s+in\s+(.+?)\s*\((\w{2})\)\s*$/i);
  if (m1) {
    loc_area = norm(m1[1]);
    loc_city = norm(m1[2]);
    loc_state = norm(m1[3]).toUpperCase();
  } else {
    // Pattern 2: "<city> (ST)"
    const m2 = s.match(/^(.+?)\s*\((\w{2})\)\s*$/i);
    if (m2) {
      loc_city = norm(m2[1]);
      loc_state = norm(m2[2]).toUpperCase();
      loc_area = loc_city;
    } else {
      // Fallback
      loc_area = s;
    }
  }

  const loc_key = `${loc_area} | ${loc_city} ${loc_state}`;

  // loc query: if we have city/state, format it 
  const loc_query =
    loc_city !== "Unknown" && loc_state !== "Unknown"
      ? loc_area === loc_city
        ? `${loc_city}, ${loc_state}`
        : `${loc_area}, ${loc_city}, ${loc_state}`
      : s;

  return { loc_area, loc_city, loc_state, loc_key, loc_query };
}

function makeLocationBucket(
  { loc_key, loc_area, loc_city, loc_state },
  found_location_raw,
) {
  //use loc_key (groups minor text variants into the same bucket)
  const k = String(loc_key || "").trim();
  if (k) return k;

  //fallback: raw location
  const s = String(found_location_raw || "").trim();
  return s.length ? s : "Unknown";
}

function classifyLocationLevel(bucket, loc_city, loc_state) {
  const b = String(bucket || "").toLowerCase();

  if (!b || b === "unknown") return "unknown";

  //area/city level
  const city = String(loc_city || "").toLowerCase();
  const st = String(loc_state || "").toLowerCase();

  // map bucket to area if its likely an area/city level
  if (
    city &&
    st &&
    b.includes(city) &&
    b.includes(st) &&
    !/\d/.test(b) &&
    !b.includes("&")
  ) {
    return "area";
  }

  //if it conatins intersection indicators
  if (b.includes(" and ") || b.includes(" & ")) return "intersection";

  //if it has numbers like in address
  if (/\d/.test(b)) return "address";

  return "area";
}

export function cleanRow(d) {
  // date parsing
  const outcome_year = num(d.outcome_year);
  const outcome_month = num(d.outcome_month);
  const intake_year = num(d.intake_year);
  const intake_month = num(d.intake_month);

  const outcome_month_date =
    outcome_year && outcome_month
      ? new Date(outcome_year, outcome_month - 1, 1)
      : null;

  const intake_month_date =
    intake_year && intake_month
      ? new Date(intake_year, intake_month - 1, 1)
      : null;

  const loc = parseFoundLocation(d.found_location);
  const found_location_raw = norm(d.found_location);
  const location_bucket = makeLocationBucket(loc, found_location_raw);
  const location_level = classifyLocationLevel(
    location_bucket,
    loc.loc_city,
    loc.loc_state,
  );

  return {
    // IDs
    animal_id_intake: norm(d.animal_id_intake),
    animal_id_outcome: norm(d.animal_id_outcome),

    // Core categories
    animal_type: norm(d.animal_type),
    breed: norm(d.breed),
    color: norm(d.color),

    intake_type: norm(d.intake_type),
    intake_condition: norm(d.intake_condition),
    sex_upon_intake: norm(d.sex_upon_intake),

    outcome_type: norm(d.outcome_type),
    outcome_subtype: norm(d.outcome_subtype),
    sex_upon_outcome: norm(d.sex_upon_outcome),

    age_group_intake: norm(d.age_upon_intake_age_group),
    age_group_outcome: norm(d.age_upon_outcome_age_group),

    // Time fields (derived)
    outcome_year,
    outcome_month,
    outcome_monthyear: norm(d.outcome_monthyear),
    outcome_month_date,

    intake_year,
    intake_month,
    intake_monthyear: norm(d.intake_monthyear),
    intake_month_date,

    // Measures
    time_in_shelter_days: num(d.time_in_shelter_days),
    count: num(d.count) ?? 1,

    // Location
    found_location_raw,
    ...loc,
    location_bucket,
    location_level,

    geo_status: d.geo_status ? String(d.geo_status).trim() : null,
    lat: num(d.lat),
    lon: num(d.lon),
  };
}
