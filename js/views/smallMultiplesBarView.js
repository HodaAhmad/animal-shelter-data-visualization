function safeStr(v) {
  return (v == null ? "" : String(v)).trim();
}

function isAdopted(d) {
  return safeStr(d.outcome_type).toLowerCase() === "adoption";
}

function wrapSvgText(
  textSelection,
  maxWidth,
  lineHeightEm = 1.35,
  maxLines = 2,
) {
  textSelection.each(function () {
    const text = d3.select(this);
    const words = (text.text() || "").split(/\s+/).filter(Boolean);

    const x = text.attr("x") ?? 0;
    const y = text.attr("y") ?? 0;
    const dy = parseFloat(text.attr("dy") || 0);

    text.text(null);

    let line = [];
    let lineNumber = 0;

    let tspan = text
      .append("tspan")
      .attr("x", x)
      .attr("y", y)
      .attr("dy", `${dy}em`);

    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      line.push(word);
      tspan.text(line.join(" "));

      if (tspan.node().getComputedTextLength() > maxWidth && line.length > 1) {
        line.pop();
        tspan.text(line.join(" "));

        line = [word];
        lineNumber += 1;

        // if we'd exceed maxLines, truncate on the previous line
        if (lineNumber >= maxLines) {
          let truncated = tspan.text();
          while (
            truncated.length > 0 &&
            tspan.node().getComputedTextLength() > maxWidth
          ) {
            truncated = truncated.slice(0, -1);
            tspan.text(truncated + "…");
          }
          return;
        }

        tspan = text
          .append("tspan")
          .attr("x", x)
          .attr("y", y)
          .attr("dy", `${lineHeightEm}em`)
          .text(word);
      }
    }

    // If we ended up with > maxLines somehow, clamp
    const tspans = text.selectAll("tspan").nodes();
    if (tspans.length > maxLines) {
      tspans.slice(maxLines).forEach((n) => n.remove());
      const last = d3.select(tspans[maxLines - 1]);
      let truncated = last.text();
      last.text(truncated + "…");
    }
  });
}

function niceAgeLabel(raw) {
  const s = String(raw);

  // grab the first two numbers in the bin label: "(12.5, 15]" => [12.5, 15]
  const nums = s.match(/-?\d+(\.\d+)?/g)?.map(Number) ?? [];
  const a = nums[0];
  const b = nums[1];

  // fallback if it doesn't look like a bin
  if (!Number.isFinite(a) || !Number.isFinite(b))
    return s.replace(/(\d+)\.0/g, "$1");

  // label helper
  const fmt = (x) => String(Math.round(x)).replace(/\.0$/, "");

  if (b <= 2.5) return "Juvenile (0–2)";
  if (b <= 5) return "Young (2–5)";
  if (b <= 7.5) return "Adult (5–7)";
  if (b <= 10) return "Adult (7–10)";

  // seniors split by ranges (NOT aggregated)
  if (b <= 12.5) return "Senior (10–12)";
  if (b <= 15) return "Senior (12+)";
  if (b <= 17.5) return "Senior (15+)";
  if (b <= 20) return "Senior (17+)";

  // beyond that: keep stepping
  return `Senior (${fmt(a)}+)`;
}

function breedGroup(d) {
  const b = safeStr(d.breed);
  if (!b) return "Unknown";
  return b.split("/")[0].replace(/ Mix$/i, "").trim();
}

function aggregateSex(d) {
  const s = safeStr(d.sex_upon_intake).toLowerCase();

  if (!s || s === "unknown") return "Unknown";
  if (/\bfemale\b/.test(s)) return "Female";
  if (/\bmale\b/.test(s)) return "Male";

  return "Unknown";
}

function getCompareAccessor(compareBy) {
  if (compareBy === "intake_type")
    return (d) => safeStr(d.intake_type) || "Unknown";
  if (compareBy === "age_group_intake")
    return (d) => safeStr(d.age_group_intake) || "Unknown";
  if (compareBy === "breed_group") return (d) => breedGroup(d) || "Unknown";
  if (compareBy === "color") return (d) => safeStr(d.color) || "Unknown";
  if (compareBy === "sex_upon_intake") return (d) => aggregateSex(d);
  return (d) => "Unknown";
}

function niceCompareLabel(compareBy, raw) {
  if (compareBy === "age_group_intake") return niceAgeLabel(raw);
  return String(raw);
}

export function renderShelterTimeSmallMultiples(rows, opts = {}) {
  const host = document.querySelector("#barChart");
  if (!host) return;

  host.innerHTML = "";
  host.style.position = "relative";

  const base = rows.filter((d) => Number.isFinite(+d.time_in_shelter_days));
  if (base.length === 0) {
    host.innerHTML = `<div style="padding:12px;color:rgba(17,24,39,0.7)">
      <div style="font-weight:600;">No shelter-time data</div>
    </div>`;
    return;
  }

  // layout: ONE ROW (horizontal scroll)
  host.style.display = "grid";
  host.style.gridTemplateColumns = "repeat(3, minmax(0, 1fr))";
  host.style.gap = "12px";
  host.style.alignItems = "stretch";

  // tooltip
  const tip = d3
    .select(host)
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

  // build each panel
  const compareBy = opts.compareBy || "intake_type"; // "intake_type" | "age_group_intake" | "breed_group"
  const metric = opts.metric || "adoption_rate"; // "adoption_rate" | "median_stay"
  const catAccessor = getCompareAccessor(compareBy);

  const alignedCats = new Set([
    "age_group_intake",
    "sex_upon_intake",
    "intake_type",
  ]);
  const useSharedCategories = alignedCats.has(compareBy);

  // keep species stable and readable 
  const speciesCounts = d3
    .rollups(
      base,
      (v) => v.length,
      (d) => safeStr(d.animal_type) || "Unknown",
    )
    .filter(([k]) => k && k !== "Unknown")
    .sort((a, b) => d3.descending(a[1], b[1]));

  const filteredSpecies = speciesCounts.filter(([s]) => {
    if (!s) return false;
    const norm = s.trim().toLowerCase();
    return norm !== "other" && norm !== "unknown";
  });

  // Force the three panels required by the story
  const wanted = ["Dog", "Cat", "Bird"];
  const speciesSet = new Set(filteredSpecies.map((d) => d[0]));
  const speciesList = wanted.filter((s) => speciesSet.has(s));

  //building globals
  let globalTop = null;
  let orderIndex = null;

  if (useSharedCategories) {
    const k = opts.topK ?? 8;
    const globalSet = new Set();

    for (const sp of speciesList) {
      const spRows = base.filter(
        (d) => (safeStr(d.animal_type) || "Unknown") === sp,
      );

      const spCounts = d3
        .rollups(
          spRows,
          (v) => v.length,
          (d) => catAccessor(d),
        )
        .filter(([key]) => key != null && String(key).trim() !== "")
        .sort((a, b) => b[1] - a[1])
        .slice(0, k)
        .map((d) => d[0]);

      spCounts.forEach((c) => globalSet.add(c));
    }

    globalTop = Array.from(globalSet).sort((a, b) => {
      const na = d3.sum(base, (d) => (catAccessor(d) === a ? 1 : 0));
      const nb = d3.sum(base, (d) => (catAccessor(d) === b ? 1 : 0));
      return nb - na;
    });

    orderIndex = new Map(globalTop.map((c, i) => [c, i]));
  }

  // build each panel (species)
  speciesList.forEach((species) => {
    const wrap = document.createElement("div");
    wrap.className = "sm-panel";
    wrap.innerHTML = `<div class="sm-title">${species}</div>`;
    host.appendChild(wrap);

    const width = 520;
    const height = 320;

    const legendH = 28;
    const margin = { top: 26, right: 45, bottom: 15 + legendH, left: 125 };

    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;

    // rows for this species only
    const panelRows = base.filter(
      (d) => (safeStr(d.animal_type) || "Unknown") === species,
    );

    let aggregated;

    if (useSharedCategories) {
      // aligned categories: use globalTop ordering
      const rowsInCats = panelRows.filter((d) =>
        orderIndex.has(catAccessor(d)),
      );

      aggregated = d3
        .rollups(
          rowsInCats,
          (v) => {
            const total = v.length;
            const adopted = v.filter(isAdopted).length;
            const adoption_rate = total ? (100 * adopted) / total : 0;
            const stays = v
              .map((d) => +d.time_in_shelter_days)
              .filter(Number.isFinite)
              .filter((x) => x > 0); // <-- drop zeros

            const median_stay = stays.length ? d3.median(stays) : null;

            return { total, adopted, adoption_rate, median_stay };
          },
          (d) => catAccessor(d),
        )
        // remove tiny/empty
        .map(([cat, s]) => ({ cat, ...s }))
        .filter((d) => d.total >= 10) // optional, but recommended
        .filter((d) => metric !== "adoption_rate" || d.adoption_rate >= 0.1)
        .filter(
          (d) =>
            metric !== "median_stay" ||
            (d.median_stay != null && d.median_stay > 0.1),
        );

      aggregated.sort((a, b) => orderIndex.get(a.cat) - orderIndex.get(b.cat));
    } else {
      // breed/color: per-species topK (keeps #bars constant and readable)
      const kLocal = opts.topK ?? 8;

      aggregated = d3
        .rollups(
          panelRows,
          (v) => {
            const total = v.length;
            const adopted = v.filter(isAdopted).length;
            const adoption_rate = total ? (100 * adopted) / total : 0;
            const stays = v
              .map((d) => +d.time_in_shelter_days)
              .filter(Number.isFinite)
              .filter((x) => x > 0); // <-- drop zeros

            const median_stay = stays.length ? d3.median(stays) : null;

            return { total, adopted, adoption_rate, median_stay };
          },
          (d) => catAccessor(d),
        )
        .map(([cat, s]) => ({ cat, ...s }))
        .filter((d) => d.total >= 10)
        .filter((d) => metric !== "adoption_rate" || d.adoption_rate >= 1)
        .filter(
          (d) =>
            metric !== "median_stay" ||
            (d.median_stay != null && d.median_stay > 0.1),
        )
        .sort((a, b) => {
          const av = metric === "median_stay" ? a.median_stay : a.adoption_rate;
          const bv = metric === "median_stay" ? b.median_stay : b.adoption_rate;
          return d3.descending(bv, av);
        })
        .slice(0, kLocal);
    }

    // sort
    const valueKey = metric === "median_stay" ? "median_stay" : "adoption_rate";

    if (useSharedCategories) {
      aggregated.sort((a, b) => orderIndex.get(a.cat) - orderIndex.get(b.cat));
    }

    // guard
    if (aggregated.length === 0) {
      wrap.innerHTML += `<div style="padding:10px;color:rgba(17,24,39,0.6);font-size:12px">
        No data for selected settings.
      </div>`;
      return;
    }

    // scales
    const xMax = d3.max(aggregated, (d) => d[valueKey]) || 1;

    const x = d3.scaleLinear().domain([0, xMax]).range([0, innerW]).nice();

    const y = d3
      .scaleBand()
      .domain(aggregated.map((d) => d.cat))
      .range([0, innerH])
      .padding(0.32);

    const svg = d3
      .select(wrap)
      .append("svg")
      .attr("viewBox", `0 0 ${width} ${height}`)
      .attr("preserveAspectRatio", "xMidYMid meet")
      .style("width", "100%")
      .style("height", "auto");

    const g = svg
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    // y-axis labels
    const yAxisG = g.append("g").call(
      d3
        .axisLeft(y)
        .tickSize(0)
        .tickFormat((d) => niceCompareLabel(compareBy, d)),
    );

    yAxisG
      .selectAll("text")
      .attr("font-size", 12.5)
      .attr("x", -10)
      .attr("y", -5)
      .attr("fill", "rgba(17,24,39,0.85)");

    yAxisG
      .selectAll(".tick text")
      .attr("dy", "0.32em") // vertical centering of tick label
      .style("dominant-baseline", "middle");

    // wrap most labels to fit inside left margin
    wrapSvgText(yAxisG.selectAll(".tick text"), margin.left - 15, 1.55, 2);

    // x-axis
    g.append("g")
      .attr("transform", `translate(0,${innerH})`)
      .call(
        d3
          .axisBottom(x)
          .ticks(4)
          .tickFormat(metric === "adoption_rate" ? (d) => `${d}%` : undefined),
      )
      .selectAll("text")
      .attr("font-size", 11);

    // bars (single series)
    g.selectAll("rect.bar")
      .data(aggregated)
      .join("rect")
      .attr("class", "bar")
      .attr("x", 0)
      .attr("y", (d) => y(d.cat))
      .attr("height", y.bandwidth())
      .attr("width", (d) => x(d[valueKey]))
      .attr("rx", 0)
      .attr("fill", "rgba(78, 121, 167, 1)")
      .on("mousemove", (event, d) => {
        const hostRect = host.getBoundingClientRect();
        tip
          .style("opacity", 1)
          .html(
            `<div style="font-weight:650;margin-bottom:4px;">${species} | ${niceCompareLabel(compareBy, d.cat)}</div>
             <div>Adoption rate: <b>${d.adoption_rate.toFixed(1)}%</b></div>
             <div>Median stay: <b>${d.median_stay.toFixed(1)}</b> days</div>
             <div>Records: <b>${d.total}</b></div>
            <div>Adopted: <b>${d.adopted}</b></div>`,
          )
          .style("left", `${event.clientX - hostRect.left + 12}px`)
          .style("top", `${event.clientY - hostRect.top + 12}px`);
            d3.select(this).attr("opacity", 0.9);
      })
      .on("mouseleave", () => tip.style("opacity", 0))
        d3.select(this).attr("opacity", 0.55);


    // value labels (optional)
    g.selectAll("text.value")
      .data(aggregated)
      .join("text")
      .attr("class", "value")
      .attr("x", (d) => x(d[valueKey]) + 6)
      .attr("y", (d) => (y(d.cat) ?? 0) + y.bandwidth() / 2 + 4)
      .attr("font-size", 11)
      .attr("fill", "rgba(17,24,39,0.55)")
      .text((d) => {
        if (metric === "adoption_rate") return `${d.adoption_rate.toFixed(1)}%`;
        return d.median_stay.toFixed(1);
      });

    // panel legend (metric label)
    const legend = svg
      .append("g")
      .attr(
        "transform",
        `translate(${margin.left},${margin.top + innerH + 40})`,
      );

    const metricLabel =
      metric === "adoption_rate"
        ? "Bar = Adoption rate (%)"
        : "Bar = Median stay (days)";

    legend
      .append("text")
      .attr("x", 0)
      .attr("y", 0)
      .attr("font-size", 11)
      .attr("fill", "rgba(17,24,39,0.75)")
      .text(metricLabel);
  });
}
