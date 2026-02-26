function safeDate(v) {
  return v instanceof Date && !Number.isNaN(+v) ? v : null;
}

const OUTCOME_GROUPS = [
  { name: "Adoption", match: (v) => v === "Adoption" },
  { name: "Return to Owner", match: (v) => v === "Return to Owner" },
  { name: "Transfer", match: (v) => v === "Transfer" },
  { name: "Euthanasia", match: (v) => v === "Euthanasia" },
  { name: "Died", match: (v) => v === "Died" },
];

export function renderTimeView(rows, opts = {}) {
  const container = document.querySelector("#timeChart");
  if (!container) return;

  const outcomeField = opts.outcomeField || "outcome_type";
  const mode = opts.mode || "adoptions"; // "adoptions" | "outcomes"

  container.innerHTML = "";
  container.style.position = "relative";

  const onHighlightChange = opts.onHighlightChange;

  const width = container.clientWidth || 700;
  const height = container.clientHeight || 320;
  if (width < 150 || height < 150) return;

  // Aggregate monthly counts using intake_month_date

  const dateField = opts.dateField || "outcome_month_date";

  let series = [];

  if (mode === "adoptions") {
    const rolled = d3
      .rollups(
        rows.filter((d) => d[outcomeField] === "Adoption"),
        (v) => v.length,
        (d) => safeDate(d[dateField]),
      )
      .filter(([k]) => k)
      .map(([date, value]) => ({ date, value }))
      .sort((a, b) => d3.ascending(a.date, b.date));

    series = [{ name: "Adoption", values: rolled }];
  } else {
    series = OUTCOME_GROUPS.map((g) => {
      const rolled = d3
        .rollups(
          rows.filter((d) => g.match(d[outcomeField])),
          (v) => v.length,
          (d) => safeDate(d[dateField]),
        )
        .filter(([k]) => k)
        .map(([date, value]) => ({ date, value }))
        .sort((a, b) => d3.ascending(a.date, b.date));

      return { name: g.name, values: rolled };
    });
  }

  let activeSeries = "All"; // "All" or one of series names

  function isActive(name) {
    return activeSeries === "All" || activeSeries === name;
  }

  const allPoints = series.flatMap((s) => s.values);

  const dateSet = new Set(allPoints.map((d) => +d.date));
  const dates = Array.from(dateSet, (ms) => new Date(ms)).sort(d3.ascending);
  const bisectDate = d3.bisector((d) => d).left;

  const lookup = new Map(
    series.map((s) => [
      s.name,
      new Map(s.values.map((p) => [+p.date, p.value])),
    ]),
  );

  const margin = { top: 16, right: 24, bottom: 106, left: 48 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  const svg = d3
    .select(container)
    .append("svg")
    .attr("width", width)
    .attr("height", height)
    .attr("role", "img")
    .attr("aria-label", "Monthly intakes over time line chart");

  const g = svg
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  // Scales
  const x = d3
    .scaleTime()
    .domain(d3.extent(allPoints, (d) => d.date))
    .range([0, innerWidth]);

  const y = d3
    .scaleLinear()
    .domain([0, d3.max(allPoints, (d) => d.value) || 1])
    .range([innerHeight, 0])
    .nice();

  // X axis (labels only)
  g.append("g")
    .attr("transform", `translate(0,${innerHeight})`)
    .call(
      d3
        .axisBottom(x)
        .ticks(d3.timeYear.every(1))
        .tickFormat(d3.timeFormat("%Y")),
    )
    .selectAll("text")
    .attr("fill", "rgba(17,24,39,0.6)")
    .attr("font-size", 11);

  // Y gridlines
  g.append("g")
    .attr("class", "y-grid")
    .call(d3.axisLeft(y).ticks(5).tickSize(-innerWidth).tickFormat(""))
    .call((g) => g.selectAll("line").attr("stroke", "rgba(17, 24, 39, 0.13)"))
    .call((g) => g.select(".domain").remove());

  // Y axis labels (on top)
  g.append("g")
    .call(d3.axisLeft(y).ticks(5))
    .selectAll("text")
    .attr("font-size", 11)
    .attr("fill", "rgba(17,24,39,0.6)");

  // Line
  const color = new Map([
    ["Adoption", "rgba(59,130,246,0.9)"],
    ["Return to Owner", "rgba(16,185,129,0.9)"],
    ["Transfer", "rgba(234,179,8,0.95)"],
    ["Euthanasia", "rgba(239,68,68,0.85)"],
    ["Died", "rgba(107,114,128,0.85)"],
  ]);

  const line = d3
    .line()
    .x((d) => x(d.date))
    .y((d) => y(d.value));

  const paths = g
    .selectAll("path.series")
    .data(series)
    .join("path")
    .attr("class", "series")
    .attr("data-name", (d) => d.name)
    .attr("fill", "none")
    .attr("stroke-width", 2)
    .attr("stroke", (d) => color.get(d.name) || "rgba(59,130,246,0.9)")
    .attr("d", (d) => line(d.values))
    .attr("opacity", (d) => (isActive(d.name) ? 1 : 0.12));

  //animation
  const shouldAnimate = opts.animate ?? true;
  if (shouldAnimate) {
    paths
      .attr("stroke-linecap", "round")
      .attr("stroke-linejoin", "round")
      .each(function () {
        const p = d3.select(this);
        const L = this.getTotalLength();

        p.attr("stroke-dasharray", `${L} ${L}`).attr(
          "stroke-dashoffset",
          L * 1.4,
        );
      })
      .transition()
      .duration(1400)
      .ease(d3.easeCubicOut)
      .attr("stroke-dashoffset", 0);
  }
  // Legend
  const legendItems =
    mode === "outcomes"
      ? ["All", ...series.map((s) => s.name)]
      : series.map((s) => s.name);

  const legendItemWidth = 140;
  const legendRowHeight = 18;
  const itemsPerRow = Math.max(1, Math.floor(innerWidth / legendItemWidth));

  const legend = svg
    .append("g")
    .attr("transform", `translate(${margin.left},${height - 45})`);

  const legendG = legend
    .selectAll("g.item")
    .data(legendItems)
    .join("g")
    .attr("class", "item")
    .attr("transform", (d, i) => {
      const col = i % itemsPerRow;
      const row = Math.floor(i / itemsPerRow);
      return `translate(${col * legendItemWidth}, ${row * legendRowHeight})`;
    });

  legendG
    .append("line")
    .attr("x1", 0)
    .attr("x2", 18)
    .attr("y1", 0)
    .attr("y2", 0)
    .attr("stroke-width", 3)
    .attr("stroke", (d) => color.get(d) || "rgba(59,130,246,0.9)")
    .attr("opacity", (d) => (d === "All" ? 1 : isActive(d) ? 1 : 0.25));

  legendG
    .append("text")
    .attr("x", 24)
    .attr("y", 4)
    .attr("font-size", 12)
    .attr("fill", "rgba(17,24,39,0.75)")
    .text((d) => d)
    .attr("opacity", (d) => (d === "All" ? 1 : isActive(d) ? 1 : 0.25));

  //cursor and logic

  legendG
    .style("cursor", mode === "outcomes" ? "pointer" : "default")
    .on("click", (event, key) => {
      if (mode !== "outcomes") return; // clickable only in breakdown

      // click "All" => clear
      if (key === "All") activeSeries = "All";
      else activeSeries = activeSeries === key ? "All" : key;

      // update line opacities
      paths.attr("opacity", (d) => (isActive(d.name) ? 1 : 0.12));

      // update legend opacities
      legend
        .selectAll("g.item line")
        .attr("opacity", (d) => (d === "All" ? 1 : isActive(d) ? 1 : 0.25));

      legend
        .selectAll("g.item text")
        .attr("opacity", (d) => (d === "All" ? 1 : isActive(d) ? 1 : 0.35));

      if (onHighlightChange) {
        onHighlightChange(activeSeries);
      }
    });

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

  //vertical guide
  const focusLine = g
    .append("line")
    .attr("y1", 0)
    .attr("y2", innerHeight)
    .attr("stroke", "rgba(17,24,39,0.25)")
    .attr("stroke-width", 1)
    .style("opacity", 0);

  const focusDot = g
    .append("circle")
    .attr("r", 4)
    .attr("fill", "rgba(59,130,246,0.95)")
    .style("opacity", 0);

  //mouse interaction adn overlay
  const bisect = d3.bisector((d) => d.date).left;
  const fmtMonth = d3.timeFormat("%Y-%m");

  g.append("rect")
    .attr("width", innerWidth)
    .attr("height", innerHeight)
    .attr("fill", "transparent")
    .on("click", function (event) {
      if (!opts.onSelectYear) return;

      const [mx] = d3.pointer(event, this);
      const xDate = x.invert(mx);

      const i = bisectDate(dates, xDate);
      const d0 = dates[Math.max(0, i - 1)];
      const d1 = dates[Math.min(dates.length - 1, i)];
      const d = !d1 ? d0 : !d0 ? d1 : xDate - d0 > d1 - xDate ? d1 : d0;

      opts.onSelectYear(d.getFullYear());
    })
    .on("dblclick", () => {
      // reset to "All years (seasonality)"
      if (opts.onSelectYear) opts.onSelectYear(null);
    })

    .on("mousemove", function (event) {
      const [mx] = d3.pointer(event, this);
      const xDate = x.invert(mx);

      const i = bisectDate(dates, xDate);
      const d0 = dates[Math.max(0, i - 1)];
      const d1 = dates[Math.min(dates.length - 1, i)];
      const d = !d1 ? d0 : !d0 ? d1 : xDate - d0 > d1 - xDate ? d1 : d0;

      const px = x(d);

      focusLine.style("opacity", 1).attr("x1", px).attr("x2", px);

      // for single-series (adoptions mode) this dot is fine
      if (mode === "outcomes" && activeSeries !== "All") {
        const v = lookup.get(activeSeries)?.get(+d) ?? 0;
        focusDot
          .style("opacity", 1)
          .attr("cx", px)
          .attr("cy", y(v))
          .attr("fill", color.get(activeSeries) || "rgba(59,130,246,0.95)");
      } else {
        const vAdopt = lookup.get("Adoption")?.get(+d) ?? 0;
        focusDot
          .style("opacity", 1)
          .attr("cx", px)
          .attr("cy", y(vAdopt))
          .attr("fill", "rgba(59,130,246,0.95)");
      }

      // tooltip: show either 1 value or multiple
      if (mode === "adoptions") {
        const vAdopt = lookup.get("Adoption")?.get(+d) ?? 0;
        tip.html(`
      <div style="font-weight:600;margin-bottom:4px;">${fmtMonth(d)}</div>
      <div>Adoptions: <b>${vAdopt}</b></div>
    `);
      } else {
        if (activeSeries !== "All") {
          const v = lookup.get(activeSeries)?.get(+d) ?? 0;
          tip.html(`
      <div style="font-weight:600;margin-bottom:4px;">${fmtMonth(d)}</div>
      <div>${activeSeries}: <b>${v}</b></div>
    `);
        } else {
          const lines = [
            "Adoption",
            "Return to Owner",
            "Transfer",
            "Euthanasia",
            "Died",
          ]
            .map(
              (k) => `<div>${k}: <b>${lookup.get(k)?.get(+d) ?? 0}</b></div>`,
            )
            .join("");

          tip.html(`
      <div style="font-weight:600;margin-bottom:4px;">${fmtMonth(d)}</div>
      ${lines}
    `);
        }
      }

      tip
        .style("opacity", 1)
        .style("left", `${event.offsetX + 12}px`)
        .style("top", `${event.offsetY + 12}px`);
    })
    .on("mouseleave", () => {
      focusLine.style("opacity", 0);
      focusDot.style("opacity", 0);
      tip.style("opacity", 0);
    });

  // Simple caption
  const label = opts.label || "Monthly intakes";
  svg
    .append("text")
    .attr("x", margin.left)
    .attr("y", height - 68)
    .attr("font-size", 11)
    .attr("fill", "rgba(17,24,39,0.55)")
    .text(label);
}
