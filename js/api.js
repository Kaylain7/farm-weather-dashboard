// All Open-Meteo API calls live here. No API key is required.
// Docs: https://open-meteo.com/en/docs

const BASE_URL = "https://api.open-meteo.com/v1/forecast";

// TODO: add a fetch wrapper with timeout, error handling and caching
export async function getForecast(lat, lon) {
  throw new Error("Not implemented yet");
}
