# Animal Shelter Data Visualization

An interactive data visualization dashboard exploring **intakes, outcomes, and shelter stay patterns** at the **Austin Animal Center** using public open data (2013–2018).

The goal of this project is to support **trend analysis, comparison, and operational insight** into how different animals enter the shelter system, how long they stay, and how outcomes vary across species and characteristics.

Demo Link: https://animal-shelter-data-visualization.vercel.app/

---

## Dataset

- **Source:** Austin Animal Center (Open Data Portal)
- **Time coverage:** 2013–2018
- **Records:** ~79,000 animal intake and outcome records
- **Key fields used:**  
  animal type, intake type, outcome type, dates, time in shelter, breed, age group, sex, location

---

## Technology

- **D3.js** for interactive visualizations
- **JavaScript (ES6)** for data processing and view coordination
- **HTML / CSS** for layout
- **Node.js scripts** for data cleaning and preprocessing

---

## What This Dashboard Shows

### 1. Key Performance Indicators (KPIs)
- Total records in the current selection
- Overall adoption rate
- Median shelter stay (days)

These provide a quick high-level summary before exploring detailed views.

---

### 2. Outcomes Over Time
- Monthly aggregation of outcomes
- Supports two modes:
  - **Adoptions trend** (single outcome over time)
  - **Outcome breakdown** (multiple outcomes over time)
- Designed to reveal **long-term trends and seasonal patterns**

---

### 3. Intake Types Over Time
- Monthly stacked bar chart
- Shows how different intake types (e.g. stray, owner surrender) vary across the year
- Enables comparison of **intake composition and seasonality**

---

### 4. Outcome Comparison by Species
- Small-multiple ranked bar charts (Dog, Cat, Bird)
- Users can compare outcomes across:
  - breed
  - age group
  - sex
  - intake type
  - color
- Two metrics:
  - **Adoption rate**
  - **Median shelter stay**
- Aggregated metrics are used instead of raw counts to support fair comparison across groups

---

### 5. Geographic Distribution
- Map-based visualization of intake locations
- Locations are aggregated into normalized location buckets
- Frequently occurring locations were geocoded to latitude/longitude
- Color intensity represents intake concentration

This view helps identify potential geographic intake hotspots across Austin.

---

## Aggregations & Design Choices

- **Monthly aggregation** is used for all time-based views to reduce noise and highlight seasonality.
- **Adoption rate** is computed as `adopted / total` per group to normalize differences in group size.
- **Median shelter stay** is used instead of the mean to reduce the influence of extreme long stays.


## How to Run

```md
## How to Run

1. Clone the repository
2. Open `index.html` in a modern browser

For best results, run using a local server:

```bash
python -m http.server
```

then open: http://localhost:8000



