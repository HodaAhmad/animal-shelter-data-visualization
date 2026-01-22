// checks for quality assurance of loaded data
export function runQA(rows) {
  console.log("Rows loaded:", rows.length);

  const missingOutcomeMonth = rows.filter(d => !d.outcome_month_date).length;
  const missingIntakeMonth = rows.filter(d => !d.intake_month_date).length;

  console.log("Missing outcome_month_date:", missingOutcomeMonth);
  console.log("Missing intake_month_date:", missingIntakeMonth);

  const missingStay = rows.filter(d => d.time_in_shelter_days == null).length;
  console.log("Missing time_in_shelter_days:", missingStay);

  // Top animal types
  const counts = new Map();
  for (const r of rows) counts.set(r.animal_type, (counts.get(r.animal_type) ?? 0) + 1);
  const topTypes = [...counts.entries()].sort((a,b) => b[1] - a[1]).slice(0, 10);
  console.log("Top animal types:", topTypes);

  console.log("\n GEO QA");

  // geo_status counts
  const geoStatusCounts = {};
  rows.forEach(d => {
    const s = d.geo_status || "MISSING";
    geoStatusCounts[s] = (geoStatusCounts[s] || 0) + 1;
  });
  console.log("Geo status distribution:");
  console.table(geoStatusCounts);

  // consistency: ok rows must have lat/lon
  const badOk = rows.filter(d =>
    d.geo_status === "ok" && (!d.lat || !d.lon)
  );
  console.log("Rows with geo_status='ok' but missing lat/lon:", badOk.length);

  //texas bounding box sanity check
  const texasBounds = {
    latMin: 25,
    latMax: 37,
    lonMin: -107,
    lonMax: -93
  };

  const outOfTexas = rows.filter(d => {
    if (d.geo_status !== "ok") return false;
    const lat = +d.lat;
    const lon = +d.lon;
    return (
      lat < texasBounds.latMin ||
      lat > texasBounds.latMax ||
      lon < texasBounds.lonMin ||
      lon > texasBounds.lonMax
    );
  });

  console.log("Geocoded rows outside Texas bounds:", outOfTexas.length);
  if (outOfTexas.length > 0) {
    console.table(outOfTexas.slice(0, 5));
  }

}
