function safeStr(v) {
  return (v == null ? "" : String(v)).trim();
}

export function renderLocationDensityView(rows, opts = {}) {
  const container = document.querySelector("#locationChart");
  if (!container) return;

  container.innerHTML = "";
  container.style.position = "relative";

  const width = container.clientWidth || 700;
  const height = container.clientHeight || 460;
  if (width < 200 || height < 200) return;

  const intakeType = opts.intakeType || "All";
  const binsX = opts.binsX ?? 34;
  const binsY = opts.binsY ?? 22;

  // 1) filter by intakeType 
  let filtered = rows;
  if (intakeType !== "All") {
    filtered = rows.filter((d) => safeStr(d.intake_type) === intakeType);
  }

  // 2) keep only rows with coordinates
  const pts = filtered.filter((d) => {
    const lat = +d.lat;
    const lon = +d.lon;
    if (safeStr(d.geo_status).toLowerCase() !== "ok") return false; 
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return false;
    if (lat === 0 || lon === 0) return false; 
    return true;
  });

  // keep only top part by latitude
  const latExtentAll = d3.extent(pts, (d) => +d.lat);
  const cut = latExtentAll[0] + 0.7 * (latExtentAll[1] - latExtentAll[0]); 
  const ptsZoom = pts.filter((d) => +d.lat >= cut);

  // guard
  if (pts.length === 0) {
    container.innerHTML = `
      <div style="padding:12px;color:rgba(17,24,39,0.75)">
        <div style="font-weight:700;margin-bottom:6px;">No geocoded points</div>
        <div style="font-size:12px;line-height:1.4">
          Your current filters produce 0 rows with lat/lon.
        </div>
      </div>`;
    return;
  }

  // 3) layout
  const margin = { top: 10, right: 10, bottom: 52, left: 10 };
  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;

  // extents
  const lonExtent = d3.extent(ptsZoom, (d) => +d.lon);
  const latExtent = d3.extent(ptsZoom, (d) => +d.lat);

  // tiny padding in degrees
  const padLon = 0.01;
  const padLat = 0.01;

  const x = d3
    .scaleLinear()
    .domain([lonExtent[0] - padLon, lonExtent[1] + padLon])
    .range([0, innerW]);

  const y = d3
    .scaleLinear()
    .domain([latExtent[0] - padLat, latExtent[1] + padLat])
    .range([innerH, 0]);

  const svg = d3
    .select(container)
    .append("svg")
    .attr("width", width)
    .attr("height", height);
  const g = svg
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  // 4) bins 
  const dx = innerW / binsX;
  const dy = innerH / binsY;

  const cells = Array.from({ length: binsX * binsY }, (_, i) => ({
    i,
    v: 0,
    // store intake type counts per cell for insight
    byType: new Map(),
  }));

  for (const p of ptsZoom) {
    const px = x(+p.lon);
    const py = y(+p.lat);

    const ix = Math.max(0, Math.min(binsX - 1, Math.floor(px / dx)));
    const iy = Math.max(0, Math.min(binsY - 1, Math.floor(py / dy)));

    const idx = iy * binsX + ix;
    const cell = cells[idx];

    cell.v += 1;

    const t = safeStr(p.intake_type) || "Unknown";
    cell.byType.set(t, (cell.byType.get(t) || 0) + 1);
  }


const maxC = d3.max(cells, (d) => d.v) || 1;


// Stepped neutral ramp
const steps = 10;

const ramp = d3.quantize(
  d3.interpolateRgb("#e5e7eb", "#111827"),
  steps
);

// Power transform to expand low values
const pow = d3.scalePow()
  .exponent(0.5)    
  .domain([0, maxC])
  .range([0, 1]);

const c = (v) => {
  if (v === 0) return "rgba(17,24,39,0.03)";
  return ramp[Math.floor(pow(v) * (steps - 1))];
};

  // tooltip
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

  let locked = false;

  function cellTopTypes(cell, k = 3) {
    const arr = Array.from(cell.byType.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, k);
    return arr;
  }

  function showTip(event, cell, ix, iy) {
    const share = ((100 * cell.v) / ptsZoom.length).toFixed(2);

    const types = cellTopTypes(cell, 3);
    const typesHtml =
      types.length === 0
        ? `<div style="color:rgba(17,24,39,0.6)">No intake type info</div>`
        : types.map(([t, c]) => `<div>${t}: <b>${c}</b></div>`).join("");

    tip
      .style("opacity", 1)
      .html(
        `<div style="font-weight:700;margin-bottom:6px;">Cell ${ix + 1}, ${iy + 1}</div>
         <div>Intakes in cell: <b>${cell.v}</b></div>
         <div>Share of geocoded: <b>${share}%</b></div>
         <div style="margin-top:6px;font-weight:600;">Top intake types</div>
         ${typesHtml}`,
      )
      .style("left", `${event.offsetX + 12}px`)
      .style("top", `${event.offsetY + 12}px`);
  }

  function hideTip() {
    if (locked) return;
    tip.style("opacity", 0);
  }

  // 5) draw cells inside draw area
  const gridG = g.append("g");

  gridG
    .selectAll("rect.cell")
    .data(cells)
    .join("rect")
    .attr("class", "cell")
    .attr("x", (d) => (d.i % binsX) * dx)
    .attr("y", (d) => Math.floor(d.i / binsX) * dy)
    .attr("width", dx)
    .attr("height", dy)
    .attr("fill", (d) => (d.v === 0 ? "rgba(17,24,39,0.01)" : c(d.v)))
    .attr("stroke", "rgba(17,24,39,0.04)")
    .on("mousemove", function (event, d) {
      const ix = d.i % binsX;
      const iy = Math.floor(d.i / binsX);
      showTip(event, d, ix, iy);
    })
    .on("mouseleave", hideTip)



  // caption
  const total = filtered.length || 1;
  const geoShare = ((100 * pts.length) / total).toFixed(1);

  // LEGEND
const legendW = 140;
const legendH = 10;
const legendX = width - 20 - legendW;
const legendY = height - 24;

const defs = svg.append("defs");
const lg = defs.append("linearGradient")
  .attr("id", "densityLegend")
  .attr("x1", "0%").attr("x2", "100%")
  .attr("y1", "0%").attr("y2", "0%");

d3.range(0, 1.0001, 0.1).forEach((t) => {
  lg.append("stop")
    .attr("offset", `${t * 100}%`)
    .attr("stop-color", c(t * maxC));
});

svg.append("rect")
  .attr("x", legendX)
  .attr("y", legendY)
  .attr("width", legendW)
  .attr("height", legendH)
  .attr("rx", 3)
  .attr("fill", "url(#densityLegend)")
  .attr("stroke", "rgba(17,24,39,0.25)");

svg.append("text")
  .attr("x", legendX)
  .attr("y", legendY - 4)
  .attr("font-size", 11)
  .attr("fill", "rgba(17,24,39,0.6)")
  .text("Intake density");

svg.append("text")
  .attr("x", legendX)
  .attr("y", legendY + legendH + 12)
  .attr("font-size", 11)
  .attr("fill", "rgba(17,24,39,0.6)")
  .text("low");

svg.append("text")
  .attr("x", legendX + legendW)
  .attr("y", legendY + legendH + 12)
  .attr("text-anchor", "end")
  .attr("font-size", 11)
  .attr("fill", "rgba(17,24,39,0.6)")
  .text("high");
  
  svg
    .append("text")
    .attr("x", margin.left)
    .attr("y", height - 10)
    .attr("font-size", 11)
    .attr("fill", "rgba(17,24,39,0.55)")
    .text(
      `Geocoded points shown: ${pts.length.toLocaleString()} (${geoShare}% of filtered)`,
    );

  svg
    .append("text")
    .attr("x", width - 10)
    .attr("y", height - 10)
    .attr("text-anchor", "end")
    .attr("font-size", 11)
    .attr("fill", "rgba(17,24,39,0.55)")
}
