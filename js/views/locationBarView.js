function safeStr(v) {
  return (v == null ? "" : String(v)).trim();
}

function niceLabel(s) {
  const v = safeStr(s);
  if (!v) return "Unknown";
  return v
    .replace(/\s*&\s*/g, " & ")
    .replace(/\s+/g, " ")
    .trim();
}

function trunc(s, n = 26) {
  s = niceLabel(s);
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

export function renderLocationBarView(rows, opts = {}) {
  const container = document.querySelector("#locationChart");

  if (!container) return;

  container.innerHTML = "";
  container.style.position = "relative";

  const width = container.clientWidth || 700;
  const height = container.clientHeight || 460;
  if (width < 150 || height < 150) return;

  const intakeType = opts.intakeType || "All";
  const topN = 15;

  //exclude overly generic buckets by default (area/city level)
  const excludeLevels = new Set(
    (opts.excludeLevels ?? ["area"]).map((s) => String(s).toLowerCase()),
  );

  //filter
  let filtered = rows;

  // intake type filter
  if (intakeType !== "All") {
    filtered = filtered.filter((d) => safeStr(d.intake_type) === intakeType);
  }

  // location level filter
  const hasLevel = rows.length > 0 && "location_level" in rows[0];
  if (hasLevel && excludeLevels.size > 0) {
    filtered = filtered.filter((d) => {
      const lvl = safeStr(d.location_level).toLowerCase();
      return !excludeLevels.has(lvl);
    });
  }

  const getBucket = (d) =>
    safeStr(d.location_bucket) ||
    safeStr(d.loc_key) ||
    safeStr(d.found_location_raw) ||
    "Unknown";

  // aggregate
  const counts = d3
    .rollups(
      filtered,
      (v) => v.length,
      (d) => getBucket(d),
    )
    .map(([bucket, value]) => ({ bucket, value }))
    .sort((a, b) => d3.descending(a.value, b.value))
    .slice(0, topN);

  //guard: no data
  if (counts.length === 0) {
    const msg = document.createElement("div");
    msg.style.padding = "12px";
    msg.style.color = "rgba(17,24,39,0.7)";
    msg.innerHTML = `
      <div style="font-weight:600;margin-bottom:6px;">No data to display</div>
      <div style="font-size:12px;">
        Try selecting <b>All</b> intake types or disabling level filtering.
      </div>
    `;
    container.appendChild(msg);
    return;
  }

  const totalFiltered = filtered.length || 1;

  //laoyout and margins
  // Estimate left margin from the longest label (after truncation)
  const maxLabelLen = d3.max(counts, (d) => trunc(d.bucket).length) || 12;
  const estLeft = Math.min(260, Math.max(140, maxLabelLen * 6.2)); // ~6.2px per char

  const margin = {
    top: 16,
    right: 22,
    bottom: 48,
    left: width < 520 ? Math.min(220, estLeft) : estLeft,
  };

  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  const svg = d3
    .select(container)
    .append("svg")
    .attr("width", width)
    .attr("height", height);

  const g = svg
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  //scales and axis
  const x = d3
    .scaleLinear()
    .domain([0, d3.max(counts, (d) => d.value) || 1])
    .range([0, innerWidth])
    .nice();

  const y = d3
    .scaleBand()
    .domain(counts.map((d) => d.bucket))
    .range([0, innerHeight])
    .padding(0.25);

  const yAxisG = g.append("g").call(
    d3
      .axisLeft(y)
      .tickSize(0)
      .tickFormat((d) => trunc(d)),
  );
  yAxisG.selectAll("text").attr("font-size", 11);
  yAxisG.select(".domain").remove();

  g.append("g")
    .attr("transform", `translate(0,${innerHeight})`)
    .call(d3.axisBottom(x).ticks(5))
    .selectAll("text")
    .attr("font-size", 11);

    g.selectAll(".domain").attr("stroke", "rgba(17,24,39,0.25)");

  //tooltip
  const tip = d3
    .select(container)
    .append("div")
    .style("position", "absolute")
    .style("pointer-events", "none")
    .style("background", "white")
    .style("border", "1px solid rgba(17,24,39,0.15)")
    .style("border-radius", "10px")
    .style("padding", "8px 10px")
    .style("font-size", "12px")
    .style("box-shadow", "0 10px 25px rgba(17,24,39,0.12)")
    .style("opacity", 0);

  //bars
  g.selectAll("rect")
    .data(counts)
    .join("rect")
    .attr("x", 0)
    .attr("y", (d) => y(d.bucket))
    .attr("height", y.bandwidth())
    .attr("width", (d) => x(d.value))
    .attr("rx", 0)
    .attr("fill", "rgba(78, 121, 167, 1)")
    .on("mousemove", (event, d) => {
      const share = ((100 * d.value) / totalFiltered).toFixed(2);
      tip
        .style("opacity", 1)
        .html(
          `<div style="font-weight:600;margin-bottom:4px;">${niceLabel(d.bucket)}</div>
           <div>Records: <b>${d.value}</b></div>
           <div>Share of filtered: <b>${share}%</b></div>`,
        )
        .style("left", `${event.offsetX + 12}px`)
        .style("top", `${event.offsetY + 12}px`);
    })
    .on("mouseleave", () => tip.style("opacity", 0));

  //labels
  g.selectAll("text.value")
    .data(counts)
    .join("text")
    .attr("class", "value")
    .attr("y", (d) => (y(d.bucket) ?? 0) + y.bandwidth() / 2 + 4)
    .attr("font-size", 11)
    .attr("fill", (d) =>
      x(d.value) > innerWidth * 0.12 ? "white" : "rgba(17,24,39,0.55)",
    )
    .attr("text-anchor", (d) =>
      x(d.value) > innerWidth * 0.12 ? "end" : "start",
    )
    .attr("x", (d) =>
      x(d.value) > innerWidth * 0.12 ? x(d.value) - 6 : x(d.value) + 6,
    )
    .text((d) => d.value);

  //caption
  svg
    .append("text")
    .attr("x", margin.left)
    .attr("y", height - 6)
    .attr("font-size", 11)
    .attr("fill", "rgba(17,24,39,0.55)")
    .text(
      `Top ${topN} locations (by record count)` +
        (intakeType !== "All" ? ` • Intake type: ${intakeType}` : ""),
    );
}
