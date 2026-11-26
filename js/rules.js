// Planting guidance rules.
// These are simple, transparent guideline thresholds for a student project, not
// agronomic advice. Every result shows the rule that produced it.

export const CROPS = {
  maize:    { label: "Maize",          temp: [18, 30], rain: [20, 120] },
  beans:    { label: "Beans",          temp: [16, 27], rain: [15, 100] },
  potatoes: { label: "Irish potatoes", temp: [10, 22], rain: [15, 100] },
  cassava:  { label: "Cassava",        temp: [20, 32], rain: [10, 120] },
};

/**
 * @param {string} cropKey  key of CROPS
 * @param {{next7Rain:number, avgTemp7:number}} summary  from summarise()
 * @returns {{status:"good"|"wait"|"wet", title:string, reasons:string[]}}
 */
export function getPlantingAdvice(cropKey, summary) {
  const crop = CROPS[cropKey];
  const rain = summary.next7Rain;
  const temp = summary.avgTemp7;
  const [minRain, maxRain] = crop.rain;
  const [minTemp, maxTemp] = crop.temp;
  const reasons = [];
  let status = "good";

  if (rain > maxRain) {
    status = "wet";
    reasons.push(`Expected rain ${rain.toFixed(0)} mm is above ${maxRain} mm: risk of waterlogging.`);
  } else if (rain < minRain) {
    status = "wait";
    reasons.push(`Expected rain ${rain.toFixed(0)} mm is below ${minRain} mm: soil may stay too dry.`);
  } else {
    reasons.push(`Expected rain ${rain.toFixed(0)} mm is within ${minRain}-${maxRain} mm.`);
  }

  if (temp < minTemp || temp > maxTemp) {
    if (status === "good") status = "wait";
    reasons.push(`Average temperature ${temp.toFixed(1)}°C is outside ${minTemp}-${maxTemp}°C.`);
  } else {
    reasons.push(`Average temperature ${temp.toFixed(1)}°C is within ${minTemp}-${maxTemp}°C.`);
  }

  const titles = { good: "Good to plant", wait: "Wait", wet: "Too wet" };
  return { status, title: titles[status], reasons };
}
