import { loadDataset } from "./data/load.js";
import { runQA } from "./data/qa.js";
import { renderLocationBarView } from "./views/locationBarView.js";
import { renderTimeView } from "./views/timeView.js";
import { renderShelterTimeSmallMultiples } from "./views/smallMultiplesBarView.js";
import { renderIntakeStackView } from "./views/intakeStackView.js";

let data = [];
let currentIntakeType = "All";
let currentOutcomeMode = "Adoption";
let highlightDecember = false;

let compareBy = "breed_group";
let metric = "adoption_rate";
let timeViewMode = "adoptions"; // "adoptions" | "outcomes"

let selectedYear = null; // null = All years
let timeHighlight = "All";

let timeAnimate = true;

function safeNum(v) {
  const x = +v;
  return Number.isFinite(x) ? x : null;
}

function computeKPIs(rows) {
  const total = rows.length;

  const adopted = rows.filter((d) => d.outcome_type === "Adoption").length;
  const adoptionRate = total ? (100 * adopted) / total : 0;

  const stays = rows
    .map((d) => safeNum(d.time_in_shelter_days))
    .filter((x) => x != null && x > 0);
  const medianStay = stays.length ? d3.median(stays) : null;

  return { total, adopted, adoptionRate, medianStay };
}

function renderActiveHighlightChip(value) {
  const el = document.getElementById("activeHighlight");
  if (!el) return;
  el.textContent = value === "All" ? "All intake types" : `Highlight: ${value}`;
}

function renderKPICards({ scopeRows, highlightRows, highlightLabel }) {
  const host = document.getElementById("kpiCards");
  if (!host) return;

  const scope = computeKPIs(scopeRows);
  const hi = computeKPIs(highlightRows);

  const sub =
    highlightLabel && highlightLabel !== "All"
      ? `Highlighted: ${highlightLabel}`
      : "All intake types";

  host.innerHTML = `
  <div class="kpi-card kpi-total">
    <div class="kpi-label">Total records</div>
    <div class="kpi-value">${scope.total.toLocaleString()}</div>
    <div class="kpi-sub">${sub}: <b>${hi.total.toLocaleString()}</b></div>
  </div>

  <div class="kpi-card kpi-adopt">
    <div class="kpi-label">Adoption rate</div>
    <div class="kpi-value">${scope.adoptionRate.toFixed(1)}%</div>
    <div class="kpi-sub">${sub}: <b>${hi.adoptionRate.toFixed(1)}%</b></div>
  </div>

  <div class="kpi-card kpi-stay">
    <div class="kpi-label">Median stay (days)</div>
    <div class="kpi-value">${scope.medianStay == null ? "—" : scope.medianStay.toFixed(1)}</div>
    <div class="kpi-sub">${sub}: <b>${hi.medianStay == null ? "—" : hi.medianStay.toFixed(1)}</b></div>
  </div>
`;
}

async function init() {
  data = await loadDataset("data/final_with_locations.csv");
  runQA(data);

  // intake type dropdown
  const select = document.getElementById("intakeTypeSelect");
  if (select) {
    const intakeTypes = Array.from(
      new Set(data.map((d) => d.intake_type).filter(Boolean)),
    ).sort();
    for (const t of intakeTypes) {
      const opt = document.createElement("option");
      opt.value = t;
      opt.textContent = t;
      select.appendChild(opt);
    }
    select.addEventListener("change", () => {
      currentIntakeType = select.value;
      render();
    });
  }

  const countEl = document.getElementById("recordCount");
  const totalEl = document.getElementById("recordTotal");

  if (countEl && totalEl) {
    countEl.textContent = data.length.toLocaleString();
    totalEl.textContent = data.length.toLocaleString();
  }

  const outcomeSelect = document.getElementById("outcomeTypeSelect");
  if (outcomeSelect) {
    outcomeSelect.addEventListener("change", () => {
      currentOutcomeMode = outcomeSelect.value; // "All" or "Adoption"
      render();
    });
  }

  function cssVar(name, fallback) {
    const v = getComputedStyle(document.documentElement)
      .getPropertyValue(name)
      .trim();
    return v || fallback;
  }

  // TIME VIEW MODE
  const timeModeEl = document.getElementById("timeModeToggle");
  if (timeModeEl) {
    timeModeEl.querySelectorAll("button").forEach((btn) => {
      btn.addEventListener("click", () => {
        timeViewMode = btn.dataset.mode; // "adoptions" | "outcomes"
        timeAnimate = true;
        // update active UI class
        timeModeEl
          .querySelectorAll("button")
          .forEach((b) => b.classList.remove("is-active"));
        btn.classList.add("is-active");

        render();
      });
    });
  }

  const compareSel = document.getElementById("compareBySelect");
  compareSel?.addEventListener("change", () => {
    compareBy = compareSel.value;
    render();
  });

  document.getElementById("toggleDecember")?.addEventListener("click", () => {
    highlightDecember = !highlightDecember;
    render();
  });

  //metric toggle
  // Small multiples METRIC toggle
  const smMetricEl = document.getElementById("smMetricToggle");
  if (smMetricEl) {
    smMetricEl.querySelectorAll("button").forEach((btn) => {
      btn.addEventListener("click", () => {
        metric = btn.dataset.metric; // "adoption_rate" | "median_stay"

        smMetricEl
          .querySelectorAll("button")
          .forEach((b) => b.classList.remove("is-active"));
        btn.classList.add("is-active");

        render();
      });
    });
  }

  // fullscreen toggle
  const btn = document.getElementById("mapFullscreenBtn");
  const mapPanel = document.getElementById("mapView");

  btn?.addEventListener("click", () => {
    mapPanel.classList.toggle("is-fullscreen");

    requestAnimationFrame(() => {
      requestAnimationFrame(() => render());
    });
  });

  // re-render map when its container resizes
  const mapBody = document.querySelector("#mapView .panel-body");
  if (mapBody) {
    const ro = new ResizeObserver(() => render());
    ro.observe(mapBody);
  }

  render();
}

function getFilteredData() {
  if (currentIntakeType === "All") return data;
  return data.filter((d) => d.intake_type === currentIntakeType);
}

function updateTimeSubtitle() {
  const el = document.getElementById("timeSubtitle");
  if (!el) return;

  const yearPart = selectedYear
    ? `Year: ${selectedYear}`
    : "Year: All years (seasonality)";

  const highlightPart =
    timeViewMode === "outcomes" && timeHighlight !== "All"
      ? ` - ${timeHighlight}`
      : "";

  el.textContent = yearPart + highlightPart;
}

function render() {
  // Base population filter (applies to ALL views)
  /*const base =
    currentIntakeType === "All"
      ? data
      : data.filter((d) => d.intake_type === currentIntakeType);
  */
  const base = data;

  const yearLabel = document.getElementById("intakeYearLabel");
  if (yearLabel) {
    yearLabel.textContent = selectedYear
      ? `Year: ${selectedYear}`
      : "Year: All years (seasonality)";
  }

  const timeSubtitle = document.getElementById("timeSubtitle");
  if (timeSubtitle) {
    const yearPart = selectedYear
      ? `Year: ${selectedYear}`
      : "Year: All years (seasonality)";
    timeSubtitle.textContent = `${yearPart}`;
  }

  // TIME VIEW: outcomes over time (requires outcome date)
  let timeRows = base.filter((d) => d.outcome_month_date);

  if (currentOutcomeMode === "Adoption" && timeViewMode === "adoptions") {
    timeRows = timeRows.filter((d) => d.outcome_type === "Adoption");
  }

  // rows used for “scope” KPIs 
  const scopeRows =
    selectedYear == null
      ? base
      : base.filter(
          (d) =>
            d.outcome_month_date &&
            d.outcome_month_date.getFullYear() === selectedYear,
        );

  // highlighted subset
  const highlightRows =
    currentIntakeType === "All"
      ? scopeRows
      : scopeRows.filter((d) => d.intake_type === currentIntakeType);

  // 1) KPIs
  renderKPICards({
    scopeRows,
    highlightRows,
    highlightLabel: currentIntakeType,
  });

  renderActiveHighlightChip(currentIntakeType);

  renderTimeView(timeRows, {
    mode: timeViewMode,
    animate: timeAnimate,
    title:
      timeViewMode === "adoptions" ? "Monthly adoptions" : "Monthly outcomes",
    label:
      timeViewMode === "adoptions" ? "Yearly adoptions" : "Yearly outcomes",

    onSelectYear: (yr) => {
      selectedYear = yr;
      timeAnimate = false;
      render();
    },
    onHighlightChange: (h) => {
      timeHighlight = h;
      updateTimeSubtitle();
      timeAnimate = false;
    },
  });

  renderLocationBarView(base, { topN: 20, intakeType: currentIntakeType });

  renderIntakeStackView(timeRows, {
    dateField: "outcome_month_date",
    intakeField: "intake_type",
    highlight: currentIntakeType,
    topK: 6,
    year: selectedYear, // <-- NEW
    label: selectedYear
      ? `${selectedYear} monthly breakdown by intake type`
      : "All years seasonality by intake type",
    onHighlight: (t) => {
      currentIntakeType = t;
      const sel = document.getElementById("intakeTypeSelect");
      if (sel) sel.value = t;
      render();
    },
  });

  renderShelterTimeSmallMultiples(data, {
    compareBy,
    metric,
    topK: 8,
    maxSpecies: 4,
  });
}

init();

// Help modal
const helpFab = document.getElementById("helpFab");
const helpModal = document.getElementById("helpModal");
const helpClose = document.getElementById("helpClose");

function openHelp() {
  helpModal.classList.add("is-open");
  helpModal.setAttribute("aria-hidden", "false");
}

function closeHelp() {
  helpModal.classList.remove("is-open");
  helpModal.setAttribute("aria-hidden", "true");
}

helpFab?.addEventListener("click", openHelp);
helpClose?.addEventListener("click", closeHelp);

// click outside to close
helpModal?.addEventListener("click", (e) => {
  if (e.target?.dataset?.close) closeHelp();
});

// ESC to close
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeHelp();
});
