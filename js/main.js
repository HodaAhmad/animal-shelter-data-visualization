import { loadDataset } from "./data/load.js";
import { runQA } from "./data/qa.js";
import { renderLocationBarView } from "./views/locationBarView.js";

let data = [];
let currentIntakeType = "All";

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

function render() {
  const filtered = getFilteredData();
  renderLocationBarView(filtered, { topN: 20 });
}

init();
