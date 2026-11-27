#!/usr/bin/env python3
"""Correct districts the geocoder matched to the wrong place, then validate all
coordinates against Rwanda's bounding box. Usage: python3 tools/fix_districts.py"""
import json

# Main-town coordinates (approximate) for the districts the geocoder got wrong
FIXES = {
    "Nyarugenge": (-1.95, 30.06),   # Kigali centre
    "Gisagara":   (-2.60, 29.83),   # around Ndora
    "Nyaruguru":  (-2.68, 29.55),   # around Kibeho (was missing)
    "Rubavu":     (-1.70, 29.26),   # Gisenyi
    "Nyabihu":    (-1.66, 29.50),   # around Mukamira
    "Rusizi":     (-2.46, 28.91),   # Kamembe / Cyangugu
    "Gicumbi":    (-1.58, 30.07),   # Byumba
    "Kirehe":     (-2.27, 30.70),
    "Ngoma":      (-2.16, 30.54),   # Kibungo
    "Bugesera":   (-2.15, 30.09),   # Nyamata
}
PROVINCE = {"Nyaruguru": "Southern"}

LAT_MIN, LAT_MAX = -2.84, -1.05
LON_MIN, LON_MAX = 28.86, 30.90

with open("data/districts.json", encoding="utf-8") as f:
    districts = json.load(f)

by_name = {d["name"]: d for d in districts}
for name, (lat, lon) in FIXES.items():
    if name in by_name:
        by_name[name]["lat"], by_name[name]["lon"] = lat, lon
    else:
        districts.append({"name": name, "province": PROVINCE[name], "lat": lat, "lon": lon})

bad = [d["name"] for d in districts
       if not (LAT_MIN <= d["lat"] <= LAT_MAX and LON_MIN <= d["lon"] <= LON_MAX)]

districts.sort(key=lambda d: (d["province"], d["name"]))
with open("data/districts.json", "w", encoding="utf-8") as f:
    json.dump(districts, f, indent=2, ensure_ascii=False)

print(f"{len(districts)} districts saved.")
print("Outside Rwanda bounds:", bad if bad else "none")
