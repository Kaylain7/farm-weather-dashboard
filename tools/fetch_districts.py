#!/usr/bin/env python3
"""Build data/districts.json for Rwanda's 30 districts.

Coordinates come from the Open-Meteo geocoding API (https://open-meteo.com/en/docs/geocoding-api),
so nothing is typed in by hand. Run it once, then CHECK the printed output:
each point should fall inside Rwanda (lat about -1 to -3, lon about 28.8 to 30.9).

Usage (from the project root):  python3 tools/fetch_districts.py
"""
import json
import time
import urllib.parse
import urllib.request

PROVINCES = {
    "Kigali City": ["Gasabo", "Kicukiro", "Nyarugenge"],
    "Southern": ["Nyanza", "Gisagara", "Nyaruguru", "Huye", "Nyamagabe",
                 "Ruhango", "Muhanga", "Kamonyi"],
    "Western": ["Karongi", "Rutsiro", "Rubavu", "Nyabihu", "Ngororero",
                "Rusizi", "Nyamasheke"],
    "Northern": ["Rulindo", "Gakenke", "Musanze", "Burera", "Gicumbi"],
    "Eastern": ["Rwamagana", "Nyagatare", "Gatsibo", "Kayonza", "Kirehe",
                "Ngoma", "Bugesera"],
}

GEOCODE_URL = "https://geocoding-api.open-meteo.com/v1/search"


def lookup(name):
    """Return the first Rwandan match for a place name, or None."""
    params = urllib.parse.urlencode(
        {"name": name, "count": 10, "country_code": "RW", "language": "en"}
    )
    with urllib.request.urlopen(f"{GEOCODE_URL}?{params}", timeout=15) as resp:
        results = json.load(resp).get("results") or []
    return results[0] if results else None


def main():
    districts, missing = [], []
    for province, names in PROVINCES.items():
        for name in names:
            hit = lookup(name)
            if hit is None:
                missing.append(name)
                print(f"NOT FOUND: {name}")
                continue
            entry = {
                "name": name,
                "province": province,
                "lat": round(hit["latitude"], 4),
                "lon": round(hit["longitude"], 4),
            }
            districts.append(entry)
            print(f"{name:12} {province:12} {entry['lat']:8} {entry['lon']:8}")
            time.sleep(0.2)  # be polite to the free API

    with open("data/districts.json", "w", encoding="utf-8") as f:
        json.dump(districts, f, indent=2, ensure_ascii=False)

    print(f"\nWrote {len(districts)} districts to data/districts.json")
    if missing:
        print("Add these by hand (search the name on openstreetmap.org):", ", ".join(missing))


if __name__ == "__main__":
    main()
