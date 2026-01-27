# Animal Shelter Data Visualization

An interactive data visualization dashboard exploring **intakes, outcomes, and shelter stay patterns** at the **Austin Animal Center** using public open data (2013–2018).

The goal of this project is to support **trend analysis, comparison, and operational insight** into how different animals enter the shelter system, how long they stay, and how outcomes vary across species and characteristics.

---

## Dataset

- **Source:** Austin Animal Center (Open Data Portal)
- **Time coverage:** 2013–2018
- **Records:** ~79,000 animal intake and outcome records
- **Key fields used:**  
  animal type, intake type, outcome type, dates, time in shelter, breed, age group, sex, location

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
- Ranked view of intake locations
- Highlights spatial concentration of shelter activity

---

## Aggregations & Design Choices

- **Monthly aggregation** is used for all time-based views to reduce noise and highlight seasonality.
- **Adoption rate** is computed as `adopted / total` per group to normalize differences i


## How to Run

Open `index.html` in a modern web browser.
