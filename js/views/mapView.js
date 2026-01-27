//ignore : d3 heatmap of intake types by location
export async function renderMapView(rows, opts = {}) {
  const container = document.querySelector("#mapView .panel-body");
  if (!container) return;

  container.innerHTML = "";

  const width = container.clientWidth || 600;
  const height = container.clientHeight || 420;

  if (!width || width < 100) return;

  const margin = { top: 40, right: 20, bottom: 20, left: 220 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  const svg = d3
    .select(container)
    .append("svg")
    .attr("width", width)
    .attr("height", height)
    .attr("role", "img")
    .attr("aria-label", "Heatmap of intake types by location");

  const g = svg
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  //data
  const TOP_N = 15;

  //normalize strings to avoid domain mismatch
  const clean = rows
    .filter(
      (d) =>
        (d.found_location_raw || d.found_location) &&
        (d.intake_type || d.intakeType),
    )
    .map((d) => ({
      location: String(d.found_location_raw || d.found_location).trim(),
      intake: String(d.intake_type || d.intakeType).trim(),
      w: +d.count || 1,
    }));

  const byLocIntake = d3.rollup(
    clean,
    (v) => d3.sum(v, (d) => d.w),
    (d) => d.location,
    (d) => d.intake,
  );

  //totals by location
  const totalsByLocation = Array.from(byLocIntake, ([loc, intakeMap]) => {
    const total = d3.sum(Array.from(intakeMap.values()));
    return [loc, total];
  });

  const topLocations = totalsByLocation
    .sort((a, b) => d3.descending(a[1], b[1]))
    .slice(0, TOP_N)
    .map((d) => d[0]);

  // intake types
  const intakeTypes = Array.from(new Set(clean.map((d) => d.intake))).sort();

  const matrix = [];
  for (const loc of topLocations) {
    const intakeMap = byLocIntake.get(loc) || new Map();
    for (const type of intakeTypes) {
      matrix.push({
        location: loc,
        intake: type,
        value: intakeMap.get(type) || 0,
      });
    }
  }

  const maxValue = d3.max(matrix, (d) => d.value) || 1;

  //scales and axiss
  const x = d3
    .scaleBand()
    .domain(intakeTypes)
    .range([0, innerWidth])
    .padding(0.05);

  const y = d3
    .scaleBand()
    .domain(topLocations)
    .range([0, innerHeight])
    .padding(0.05);

  const color = d3
    .scaleSequentialLog()
    .domain([1, maxValue]) // log can’t take 0
    .interpolator(d3.interpolateBlues);

  g.append("g").call(d3.axisTop(x)).selectAll("text").attr("font-size", 11);

  g.append("g")
    .call(d3.axisLeft(y))
    .selectAll("text")
    .attr("font-size", 11)
    .call(wrapText, 200); // wrap long location labels

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

  container.style.position = "relative";
  console.log("heatmap:", {
    nRows: topLocations.length,
    nCols: intakeTypes.length,
    maxValue,
  });
  console.log("mapView keys:", Object.keys(rows[0] || {}));

  //cells
  g.selectAll("rect")
    .data(matrix)
    .join("rect")
    .attr("x", (d) => x(d.intake))
    .attr("y", (d) => y(d.location))
    .attr("width", x.bandwidth())
    .attr("height", y.bandwidth())
    .attr("fill", (d) => (d.value === 0 ? "#f5f7fb" : color(d.value)))
    .attr("stroke", "white")
    .attr("stroke-width", 0.6)
    .on("mousemove", (event, d) => {
      tip
        .style("opacity", 1)
        .html(
          `<div style="font-weight:600;margin-bottom:4px;">${d.location}</div>
           <div>Intake type: <b>${d.intake}</b></div>
           <div>Count: <b>${d.value}</b></div>`,
        )
        .style("left", `${event.offsetX + 12}px`)
        .style("top", `${event.offsetY + 12}px`);
    })
    .on("mouseleave", () => tip.style("opacity", 0));

  svg
    .append("text")
    .attr("x", margin.left)
    .attr("y", height - 6)
    .attr("font-size", 11)
    .attr("fill", "rgba(17,24,39,0.55)")
    .text("Top intake locations × intake type (counts)");
}
//text wrapping for y-axis labels
function wrapText(text, width) {
  text.each(function () {
    const textSel = d3.select(this);
    const words = textSel.text().split(/\s+/).reverse();
    let word;
    let line = [];
    let lineNumber = 0;
    const lineHeight = 1.1;
    const y = textSel.attr("y");
    const dy = parseFloat(textSel.attr("dy")) || 0;
    let tspan = textSel
      .text(null)
      .append("tspan")
      .attr("x", -10)
      .attr("y", y)
      .attr("dy", dy + "em");

    while ((word = words.pop())) {
      line.push(word);
      tspan.text(line.join(" "));
      if (tspan.node().getComputedTextLength() > width) {
        line.pop();
        tspan.text(line.join(" "));
        line = [word];
        tspan = textSel
          .append("tspan")
          .attr("x", -10)
          .attr("y", y)
          .attr("dy", ++lineNumber * lineHeight + dy + "em")
          .text(word);
      }
    }
  });
}
