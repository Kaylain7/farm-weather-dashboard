// All Open-Meteo API calls live here. No API key is required.
// Docs: https://open-meteo.com/en/docs

const BASE_URL = "https://api.open-meteo.com/v1/forecast";
const PAST_DAYS = 30;
const FORECAST_DAYS = 7;
const TIMEOUT_MS = 10000;               // give up after 10 seconds
const CACHE_TTL_MS = 20 * 60 * 1000;    // treat cached data as fresh for 20 minutes
const CACHE_KEY = "fwd:forecasts:v1";

/** fetch() with a timeout and friendly, specific error messages. */
async function fetchJson(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) {
      throw new Error(`The weather service returned an error (HTTP ${res.status}).`);
    }
    return await res.json();
  } catch (err) {
    if (err.name === "AbortError") {
      throw new Error("The weather service took too long to respond.");
    }
    if (err instanceof SyntaxError) {
      throw new Error("The weather service sent an invalid response.");
    }
    if (err instanceof TypeError) {
      throw new Error("Could not reach the weather service. Check your internet connection.");
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/** Read the cached response, or null if missing/corrupt. */
function readCache() {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY));
  } catch {
    return null;
  }
}

function writeCache(raw, count) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ savedAt: Date.now(), count, raw }));
  } catch {
    /* storage full or disabled: caching is only a bonus, so ignore */
  }
}

/** Check that the API answer has the shape the app expects. */
function validate(json, expectedCount) {
  const list = Array.isArray(json) ? json : [json];
  const ok =
    list.length === expectedCount &&
    list.every((item) => item && item.daily && Array.isArray(item.daily.time) && item.current);
  if (!ok) throw new Error("The weather service sent data in an unexpected format.");
  return list;
}

/**
 * Fetch weather for every district in ONE request (Open-Meteo accepts
 * comma-separated coordinates). Returns { raw, savedAt, source, error? }
 * where source is "network", "cache" or "stale" (old cache used because the API failed).
 */
export async function getAllForecasts(districts) {
  const cached = readCache();
  const cacheMatches = cached && cached.count === districts.length;

  if (cacheMatches && Date.now() - cached.savedAt < CACHE_TTL_MS) {
    return { raw: cached.raw, savedAt: cached.savedAt, source: "cache" };
  }

  const params = new URLSearchParams({
    latitude: districts.map((d) => d.lat).join(","),
    longitude: districts.map((d) => d.lon).join(","),
    current: "temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m,weather_code",
    daily: "temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max",
    past_days: PAST_DAYS,
    forecast_days: FORECAST_DAYS,
    timezone: "Africa/Kigali",
  });

  try {
    const json = await fetchJson(`${BASE_URL}?${params}`);
    const raw = validate(json, districts.length);
    writeCache(raw, districts.length);
    return { raw, savedAt: Date.now(), source: "network" };
  } catch (err) {
    if (cacheMatches) {
      // Fall back to older data instead of showing nothing
      return { raw: cached.raw, savedAt: cached.savedAt, source: "stale", error: err.message };
    }
    throw err;
  }
}

/** Turn one raw API item into the simple object the UI uses. */
export function summarise(item) {
  const d = item.daily;
  const n = d.time.length;
  const split = n - FORECAST_DAYS; // everything before this index is the past
  const rain = (i) => d.precipitation_sum[i] ?? 0;

  const days = [];
  for (let i = split; i < n; i++) {
    days.push({
      date: d.time[i],
      max: d.temperature_2m_max[i],
      min: d.temperature_2m_min[i],
      rain: rain(i),
      prob: d.precipitation_probability_max[i] ?? 0,
    });
  }

  const sum = (arr) => arr.reduce((a, b) => a + b, 0);
  const avg = (arr) => (arr.length ? sum(arr) / arr.length : 0);

  return {
    current: item.current,
    days,
    past30Rain: sum(days.length ? d.precipitation_sum.slice(0, split).map((v) => v ?? 0) : []),
    next7Rain: sum(days.map((x) => x.rain)),
    avgTemp7: avg(days.map((x) => (x.max + x.min) / 2)),
  };
}
