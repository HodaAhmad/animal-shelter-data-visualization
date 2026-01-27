function safeDate(v) {
  return v instanceof Date && !Number.isNaN(+v) ? v : null;
}


export function renderIntakeStackView(rows, opts = {}) {
  const container = document.querySelector("#intakeStackChart");
  if (!container) return;

  const year = opts.year ?? null; // null => seasonality

  container.innerHTML = "";
  container.style.position = "relative";

  const width = container.clientWidth || 700;
  const height = container.clientHeight || 320;
  if (width < 150 || height < 150) return;

  const dateField = opts.dateField || "outcome_month_date";
  const intakeField = opts.intakeField || "intake_type";
  const highlight = opts.highlight || "All";
  const onHighlight = opts.onHighlight;

  const filtered = rows.filter((d) => safeDate(d[dateField]) && d[intakeField]);
  const filteredYear =
    year == null
      ? filtered
      : filtered.filter((d) => d[dateField].getFullYear() === year);

  //hoose top K intake types + "Other"
  const topK = opts.topK ?? 6;
  const counts = d3
    .rollups(
      filteredYear,
      (v) => v.length,
      (d) => d[intakeField],
    )
    .sort((a, b) => d3.descending(a[1], b[1]));

  const topTypes = new Set(counts.slice(0, topK).map((d) => d[0]));
  const keys = [...topTypes];

  const legendKeys = ["All", ...keys];

  //monthly filter
  const monthMap = d3.rollup(
    filteredYear,
    (v) => v.length,
    (d) => d[dateField].getMonth(), // always 0..11
    (d) => (topTypes.has(d[intakeField]) ? d[intakeField] : "Other"),
  );

  const xDomain = d3.range(12); // always Jan..Dec
  const monthLabel = (k) => d3.timeFormat("%b")(new Date(2000, k, 1));

  const dataRows = xDomain.map((k) => {
    const typeMap = monthMap.get(year == null ? k : +k) || new Map();
    const row = { key: k };
    for (const t of keys) row[t] = typeMap.get(t) || 0;
    row.__total = d3.sum(keys, (t) => row[t]);
    return row;
  });

  const stack = d3.stack().keys(keys);
  const stacked = stack(dataRows);

  // Give room for legend
  const margin = { top: 16, right: 24, bottom: 106, left: 48 };

  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  //legend
  const legendItemWidth = 140; 
  const legendRowHeight = 18;
  const itemsPerRow = Math.max(1, Math.floor(innerWidth / legendItemWidth));

  // Tooltip 
  const tooltip = d3
    .select(container)
    .append("div")
    .style("position", "absolute")
    .style("pointer-events", "none")
    .style("opacity", 0)
    .style("background", "white")
    .style("border", "1px solid rgba(17,24,39,0.15)")
    .style("box-shadow", "0 6px 18px rgba(17,24,39,0.12)")
    .style("border-radius", "10px")
    .style("padding", "8px 10px")
    .style("font-size", "12px")
    .style("color", "rgba(17,24,39,0.9)");

  const svg = d3
    .select(container)
    .append("svg")
    .attr("width", width)
    .attr("height", height);

  const g = svg
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  // scales
  const x = d3
    .scaleBand()
    .domain(xDomain.map((d) => (year == null ? d : +d)))
    .range([0, innerWidth])
    .padding(0.12);

  const y = d3
    .scaleLinear()
    .domain([0, d3.max(dataRows, (r) => r.__total) || 1])
    .range([innerHeight, 0])
    .nice();

  // axis
  // X axis (labels only)
  g.append("g")
    .attr("transform", `translate(0,${innerHeight})`)
    .call(
      d3.axisBottom(x).tickFormat((v) => {
        if (year == null) return monthLabel(+v);
        return monthLabel(new Date(+v));
      }),
    )
    .call((g) => g.select(".domain").attr("stroke", "rgba(17,24,39,0.15)"))
    .call((g) => g.selectAll("line").attr("stroke", "rgba(17,24,39,0.12)"))
    .selectAll("text")
    .attr("font-size", 11)
    .attr("fill", "rgba(17,24,39,0.6)");

  // Y gridlines
  g.append("g")
    .attr("class", "y-grid")
    .call(d3.axisLeft(y).ticks(5).tickSize(-innerWidth).tickFormat(""))
    .call((g) => g.selectAll("line").attr("stroke", "rgba(17, 24, 39, 0.13)"))
    .call((g) => g.select(".domain").remove());

  // Y axis labels (on top)
  g.append("g")
    .call(d3.axisLeft(y).ticks(5))
    .call((g) => g.select(".domain").attr("stroke", "rgba(17,24,39,0.15)"))
    .call((g) =>
      g.selectAll(".tick line").attr("stroke", "rgba(17,24,39,0.13)"),
    )
    .selectAll("text")
    .attr("font-size", 11)
    .attr("fill", "rgba(17,24,39,0.6)");

  const palette = d3.schemePaired;

  const selected = [palette[1], palette[3], palette[5], palette[9], palette[7]];

  const color = d3.scaleOrdinal().domain(keys).range(selected);

  //legend scg
  const legend = svg
    .append("g")
    .attr(
      "transform",
      `translate(${margin.left},${height - 20 - (Math.ceil(legendKeys.length / itemsPerRow) - 1) * legendRowHeight})`,
    );

  const legendItems = legend
    .selectAll("g.legend-item")
    .data(legendKeys)
    .join("g")
    .attr("class", "legend-item")
    .attr("transform", (d, i) => {
      const col = i % itemsPerRow;
      const row = Math.floor(i / itemsPerRow);
      return `translate(${col * legendItemWidth}, ${row * legendRowHeight})`;
    })
    .style("cursor", "pointer")
    .on("click", (event, k) => {
      if (!onHighlight) return;
      // click active again => reset to All
      onHighlight(k === "All" ? "All" : highlight === k ? "All" : k);
    });

  legendItems
    .append("rect")
    .attr("x", 0)
    .attr("y", -10)
    .attr("width", 12)
    .attr("height", 12)
    .attr("rx", 3)
    .attr("fill", (k) => (k === "All" ? "rgba(17,24,39,0.25)" : color(k)))
    .attr("opacity", (k) => {
      if (highlight === "All") return 1; 
      if (k === "All") return 0.6;
      return highlight === k ? 1 : 0.25;
    });

  legendItems
    .append("text")
    .attr("x", 18)
    .attr("y", 0)
    .attr("font-size", 12)
    .attr("fill", "rgba(17,24,39,0.85)")
    .text((k) => k)
    .attr("opacity", (k) =>
      highlight === "All" || highlight === k ? 1 : 0.35,
    );

  // stacked bars
  const layers = g
    .selectAll("g.layer")
    .data(stacked)
    .join("g")
    .attr("class", "layer")
    .attr("fill", (d) => color(d.key))
    .attr("opacity", (d) => {
      if (highlight === "All") return 0.95;
      return d.key === highlight ? 0.95 : 0.2;
    });

  const rects = layers
    .selectAll("rect.segment")
    .data((d) => d.map((v) => ({ type: d.key, ...v })))
    .join("rect")
    .attr("class", "segment")
    .attr("x", (d) => x(year == null ? d.data.key : +d.data.key))
    .attr("width", x.bandwidth())
    // start collapsed at baseline
    .attr("y", y(0))
    .attr("height", 0);

  // animate to final stacked positions
  rects
    .transition()
    .duration(800)
    .ease(d3.easeCubicOut)
    .delay((d, i) => i * 12) // small cascade
    .attr("y", (d) => y(d[1]))
    .attr("height", (d) => y(d[0]) - y(d[1]));

  // keep your tooltip handlers on the rects selection
  rects
    .on("mousemove", function (event, d) {
      const total = d.data.__total || 0;
      const value = d.data[d.type] || 0;
      const pct = total ? (100 * value) / total : 0;

      const [mx, my] = d3.pointer(event, container);
      const labelMonth =
        year == null
          ? monthLabel(d.data.key)
          : monthLabel(new Date(+d.data.key));

      tooltip
        .style("opacity", 1)
        .style("left", `${mx + 12}px`)
        .style("top", `${my + 12}px`).html(`
        <div style="font-weight:700;margin-bottom:4px;">${labelMonth}</div>
        <div><span style="font-weight:600;">${d.type}</span></div>
        <div>Count: <span style="font-weight:600;">${value.toLocaleString()}</span></div>
        <div>Share: <span style="font-weight:600;">${pct.toFixed(1)}%</span></div>
        <div style="margin-top:6px;color:rgba(17,24,39,0.55);font-size:11px;">
          Total this month: ${total.toLocaleString()}
        </div>
      `);
    })
    .on("mouseleave", () => tooltip.style("opacity", 0));

  // caption
  const label = opts.label || "Monthly outcomes by intake type";
  svg
    .append("text")
    .attr("x", margin.left)
    .attr("y", height - 68)
    .attr("font-size", 11)
    .attr("fill", "rgba(17,24,39,0.55)")
    .text(label);
}
