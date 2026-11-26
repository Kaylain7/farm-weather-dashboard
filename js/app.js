// Main application logic and UI wiring.
// Security note: API data is only ever inserted with textContent (never innerHTML),
// which prevents XSS from untrusted responses.

import { getAllForecasts, summarise } from "./api.js";
import { CROPS, getPlantingAdvice } from "./rules.js";

const $ = (id) => document.getElementById(id);

let districts = [];   // from data/districts.json
let summaries = {};   // district name -> summarised weather
let selected = null;  // currently selected district name
let chart = null;

// ---------- small helpers ----------

/** Create an element with optional text and class (safe: uses textContent). */
function el(tag, text = "", className = "") {
  const node = document.createElement(tag);
  if (text !== "") node.textContent = text;
  if (className) node.className = className;
  return node;
}

function weatherLabel(code) {
  if (code === 0) return "Clear sky";
  if (code <= 3) return "Partly cloudy";
  if (code === 45 || code === 48) return "Fog";
  if (code >= 51 && code <= 57) return "Drizzle";
  if (code >= 61 && code <= 67) return "Rain";
  if (code >= 80 && code <= 82) return "Rain showers";
  if (code >= 95) return "Thunderstorm";
  return "Cloudy";
}

function formatDay(iso) {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-GB", {
    weekday: "short", day: "numeric", month: "short",
  });
}

// ---------- status banner (loading / errors / cache notices) ----------

function setStatus(message, kind = "info", withRetry = false) {
  const box = $("status");
  box.replaceChildren();
  box.className = `status ${kind}`;
  if (!message) { box.hidden = true; return; }
  box.hidden = false;
  box.append(el("span", message));
  if (withRetry) {
    const btn = el("button", "Retry");
    btn.addEventListener("click", loadData);
    box.append(btn);
  }
}

// ---------- rendering ----------

function renderCurrent() {
  const box = $("current");
  box.replaceChildren();
  const s = summaries[selected];
  if (!s) return;
  const c = s.current;
  box.append(el("h2", `${selected}: right now`));
  const grid = el("div", "", "stats");
  const stat = (label, value) => {
    const d = el("div", "", "stat");
    d.append(el("strong", value), el("span", label));
    return d;
  };
  grid.append(
    stat("Temperature", `${c.temperature_2m}°C`),
    stat("Conditions", weatherLabel(c.weather_code)),
    stat("Humidity", `${c.relative_humidity_2m}%`),
    stat("Wind", `${c.wind_speed_10m} km/h`),
    stat("Rain now", `${c.precipitation} mm`),
    stat("Last 30 days", `${s.past30Rain.toFixed(0)} mm`),
  );
  box.append(grid);
}

function renderForecast() {
  const box = $("forecast");
  box.replaceChildren();
  const s = summaries[selected];
  if (!s) return;
  box.append(el("h2", "7-day forecast"));
  const row = el("div", "", "days");
  s.days.forEach((day) => {
    const card = el("div", "", "day");
    card.append(
      el("strong", formatDay(day.date)),
      el("span", `${Math.round(day.max)}° / ${Math.round(day.min)}°`),
      el("span", `${day.rain.toFixed(1)} mm`),
      el("small", `${day.prob}% chance`),
    );
    row.append(card);
  });
  box.append(row);

  // Rainfall chart (Chart.js is loaded from a CDN in index.html)
  const canvas = el("canvas");
  box.append(canvas);
  if (chart) chart.destroy();
  if (typeof Chart === "undefined") return; // CDN blocked: the cards above still work
  chart = new Chart(canvas, {
    type: "bar",
    data: {
      labels: s.days.map((d) => formatDay(d.date)),
      datasets: [{ label: "Rainfall (mm)", data: s.days.map((d) => d.rain) }],
    },
    options: { responsive: true, plugins: { legend: { display: false } } },
  });
}

function renderAdvice() {
  const box = $("advice");
  box.replaceChildren();
  const s = summaries[selected];
  if (!s) return;
  const advice = getPlantingAdvice($("crop").value, s);
  box.append(el("h2", `Planting guidance: ${CROPS[$("crop").value].label}`));
  box.append(el("p", advice.title, `badge ${advice.status}`));
  const list = el("ul");
  advice.reasons.forEach((r) => list.append(el("li", r)));
  box.append(list);
  box.append(el("small", "Guideline thresholds only. Confirm with your local agronomist."));
}

/** Rows of the rainfall table after applying search, province filter and sorting. */
function visibleRows() {
  const query = $("search").value.trim().toLowerCase();
  const province = $("province").value;
  const sortBy = $("sort").value;

  const rows = districts
    .filter((d) => summaries[d.name])
    .filter((d) => d.name.toLowerCase().includes(query))
    .filter((d) => province === "all" || d.province === province)
    .map((d) => ({ ...d, ...summaries[d.name] }));

  const sorters = {
    name: (a, b) => a.name.localeCompare(b.name),
    rainDesc: (a, b) => b.next7Rain - a.next7Rain,
    rainAsc: (a, b) => a.next7Rain - b.next7Rain,
    past30: (a, b) => b.past30Rain - a.past30Rain,
    tempDesc: (a, b) => b.avgTemp7 - a.avgTemp7,
  };
  return rows.sort(sorters[sortBy]);
}

function renderTable() {
  const body = $("table-body");
  body.replaceChildren();
  const rows = visibleRows();
  $("no-results").hidden = rows.length > 0;
  rows.forEach((r) => {
    const tr = el("tr", "", r.name === selected ? "selected" : "");
    tr.append(
      el("td", r.name),
      el("td", r.province),
      el("td", `${r.next7Rain.toFixed(0)} mm`),
      el("td", `${r.past30Rain.toFixed(0)} mm`),
      el("td", `${r.avgTemp7.toFixed(1)}°C`),
    );
    tr.addEventListener("click", () => selectDistrict(r.name));
    body.append(tr);
  });
}

function selectDistrict(name) {
  selected = name;
  $("district").value = name;
  renderCurrent();
  renderForecast();
  renderAdvice();
  renderTable();
}

// ---------- data loading ----------

async function loadData() {
  setStatus("Loading weather data…", "info");
  try {
    const result = await getAllForecasts(districts);
    summaries = {};
    result.raw.forEach((item, i) => {
      summaries[districts[i].name] = summarise(item);
    });
    selectDistrict(selected || districts[0].name);

    const time = new Date(result.savedAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
    if (result.source === "stale") {
      setStatus(`Could not refresh (${result.error}) Showing saved data from ${time}.`, "warn", true);
    } else if (result.source === "cache") {
      setStatus(`Showing recent saved data from ${time}.`, "info");
    } else {
      setStatus("");
    }
  } catch (err) {
    setStatus(`${err.message} Please try again.`, "error", true);
  }
}

/** Show which server answered (web-01 or web-02), proving the load balancer works. */
async function showServedBy() {
  try {
    const res = await fetch("host.txt", { cache: "no-store" });
    if (res.ok) $("served-by").textContent = `Served by: ${(await res.text()).trim()}`;
  } catch {
    /* host.txt is optional (not present when running locally) */
  }
}

// ---------- startup ----------

async function init() {
  try {
    const res = await fetch("data/districts.json");
    if (!res.ok) throw new Error();
    districts = await res.json();
  } catch {
    setStatus("Could not load the district list.", "error");
    return;
  }

  districts.forEach((d) => $("district").append(new Option(d.name, d.name)));
  [...new Set(districts.map((d) => d.province))].forEach((p) => $("province").append(new Option(p, p)));
  Object.entries(CROPS).forEach(([key, c]) => $("crop").append(new Option(c.label, key)));

  $("district").addEventListener("change", (e) => selectDistrict(e.target.value));
  $("crop").addEventListener("change", renderAdvice);
  ["search", "province", "sort"].forEach((id) => {
    $(id).addEventListener("input", renderTable);
  });

  showServedBy();
  loadData();
}

init();
