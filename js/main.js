import { loadDataset } from "./data/load.js";
import { runQA } from "./data/qa.js";

async function init() {
  const data = await loadDataset("data/final.csv");
  runQA(data);

}

init();
