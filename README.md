# Farm Weather & Planting Dashboard

A web dashboard that gives Rwandan farmers weather, rainfall and simple planting guidance for all 30 districts. It uses live data from the Open-Meteo API and is deployed on two web servers behind a load balancer.

- **Live site (through the load balancer):** https://www.kaylaininc.tech/farm/
- **Demo video (max 2 min):** TODO: add link
- **Credentials:** none needed. The app has no login, and Open-Meteo requires no API key.

## Why this app
Planting at the wrong time costs smallholder farmers seed, labour and a whole season. Rainfall and temperature decide a lot of that, but forecasts are usually shown for a single city. This dashboard puts every district side by side, so a farmer or cooperative can quickly see where rain is expected, where it has been dry, and whether conditions suit a crop.

## Features
- **Current weather** for the selected district: temperature, conditions, humidity, wind and rain right now, plus rainfall over the last 30 days.
- **7-day forecast** with daily highs and lows, expected rainfall, chance of rain and a rainfall bar chart.
- **Planting guidance** for maize, beans, Irish potatoes and cassava: "Good to plant", "Wait" or "Too wet", with the rule that produced the result.
- **Rainfall table for all 30 districts** with:
  - search by district name
  - filter by province
  - five sort options (most or least rain in the next 7 days, most rain in the last 30 days, warmest, A-Z)
  - click a row to open that district
- **Error handling:** a 10-second timeout, specific messages for a slow service, a lost connection or an invalid response, and a Retry button. If a refresh fails, the app shows the last saved data with a notice instead of an empty page.
- **Caching:** API responses are kept in `localStorage` for 20 minutes to reduce load and speed up repeat visits.
- **Server indicator:** the footer shows which server (web-01 or web-02) answered, which makes the load balancing visible.
- Responsive layout that works on phones.

## Screenshots
TODO: add screenshots (desktop, mobile width, error state)

## API used
**[Open-Meteo](https://open-meteo.com/)** by the Open-Meteo team. Weather data is licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/), and the free API is intended for non-commercial use.

| Endpoint | Used for | Docs |
| --- | --- | --- |
| Forecast API (`/v1/forecast`) | Current weather, 7-day forecast and the past 30 days of rainfall, for all 30 districts in a single request | https://open-meteo.com/en/docs |
| Geocoding API (`/v1/search`) | A one-off script (`tools/fetch_districts.py`) that looked up district coordinates | https://open-meteo.com/en/docs/geocoding-api |

No API key is needed, so there are no secrets in this repository. The app calls the API directly from the browser.

## Project structure
```
index.html              page layout
css/style.css           styles
js/app.js               UI, search, sort, filter, rendering
js/api.js               Open-Meteo calls, timeout, validation, caching
js/rules.js             planting guidance rules
data/districts.json     30 districts with province and coordinates
tools/                  helper scripts used to build districts.json
nginx/farm-weather.conf nginx snippet used on web-01 and web-02
haproxy/haproxy.cfg     copy of the load balancer config from lb-01
deploy.sh               deployment script for web-01 and web-02
```

## Run locally
You need a browser and Python 3 (or any static file server).
```bash
git clone https://github.com/Kaylain7/farm-weather-dashboard.git
cd farm-weather-dashboard
python3 -m http.server 8000
```
Open http://localhost:8000. The page must be served over HTTP like this, because opening `index.html` directly blocks the JavaScript modules in most browsers.

## Deployment
The app runs on two web servers (Ubuntu 20.04, nginx) behind one load balancer (HAProxy):

| Server | Role | Address |
| --- | --- | --- |
| 6986-web-01 | web server | 13.40.6.158 |
| 6986-web-02 | web server | 35.176.209.123 |
| 6986-lb-01 | load balancer | 13.40.122.119 (www.kaylaininc.tech) |

### Web servers (web-01 and web-02)
Both servers already ran nginx with a default site from earlier course projects (a custom 404 page, a redirect and an `X-Served-By` header). To avoid breaking that, the dashboard is served under the path `/farm/` through a small nginx snippet that is included once inside the existing `server` block.

`deploy.sh` does the following and is safe to run repeatedly:
1. Installs nginx, git and rsync if missing.
2. Clones (or pulls) the repository into `/opt/farm-weather-repo`, which nginx does not serve.
3. Copies only the files the browser needs into `/var/www/farm-weather`, leaving out `.git`, scripts and config files.
4. Writes `host.txt` containing the server name, which the footer displays.
5. Installs `nginx/farm-weather.conf` and includes it in the default site if it is not already included.
6. Runs `nginx -t`, reloads nginx and checks that `/farm/` returns HTTP 200.

To deploy or update, run on each server:
```bash
sudo git clone https://github.com/Kaylain7/farm-weather-dashboard.git /opt/farm-weather-repo   # first time only
bash /opt/farm-weather-repo/deploy.sh web-01     # use web-02 on the second server
```
The nginx snippet (`nginx/farm-weather.conf`):
```nginx
location = /farm { return 301 /farm/; }
location /farm/ {
    alias /var/www/farm-weather/;
    try_files $uri $uri/index.html =404;
}
```
The existing site also adds an `X-Served-By: $hostname` response header, which is used below to prove which server answered.

### Load balancer (lb-01)
HAProxy 2.0 runs on lb-01 and terminates HTTPS for www.kaylaininc.tech (certificate from Let's Encrypt). It forwards requests to both web servers using **round-robin**, with health checks so a failed server is taken out of rotation. The full file is in `haproxy/haproxy.cfg`. The important part:
```
backend http_back
    balance roundrobin
    server 6986-web-01 13.40.6.158:80 check
    server 6986-web-02 35.176.209.123:80 check
```
Plain HTTP on port 80 is redirected to HTTPS with a 301.

## Testing the load balancer
Six consecutive requests through the load balancer. The `x-served-by` header alternates between the two servers, and every response is 200:
```
$ for i in 1 2 3 4 5 6; do curl -sI https://www.kaylaininc.tech/farm/ | grep -i "HTTP/\|x-served-by"; done
HTTP/1.1 200 OK
x-served-by: 6986-web-01
HTTP/1.1 200 OK
x-served-by: 6986-web-02
HTTP/1.1 200 OK
x-served-by: 6986-web-01
HTTP/1.1 200 OK
x-served-by: 6986-web-02
HTTP/1.1 200 OK
x-served-by: 6986-web-01
HTTP/1.1 200 OK
x-served-by: 6986-web-02
```
The footer of the page shows the same thing: refreshing flips "Served by" between web-01 and web-02.

**Failover test:** TODO: after running the failover test, paste the output here. Stop nginx on web-01 (`sudo service nginx stop`), repeat the requests (all should return 200 from web-02), then restart nginx and show that the traffic alternates again.

## Security notes
- No API keys or credentials exist in the code or the repository (`.gitignore` also excludes `.env` and `config.js`).
- Data from the API is only inserted into the page with `textContent`, never `innerHTML`, so a malicious response cannot inject script.
- The servers serve a clean copy of the app, so `.git`, scripts and configuration files are not reachable from the web.
- Traffic to the live site is encrypted with HTTPS at the load balancer.

## Challenges and how I solved them
- **Wrong district coordinates.** The geocoding API matched nine districts to places in other countries or to the wrong place inside Rwanda, and one district (Nyaruguru) was not found. I noticed because some latitudes fell outside Rwanda's bounds, so I added a correction script (`tools/fix_districts.py`) that overrides those districts with the main town's coordinates and checks every entry against Rwanda's bounding box.
- **An existing server config.** Both servers already had a default nginx site from earlier projects, and adding a second server block on port 80 would not have taken effect. I read the existing config first and added the dashboard under `/farm/` through an included snippet, leaving the original site untouched.
- **Files copied incorrectly on web-01.** The first copy step silently failed because `rsync` was not installed on that server, so only `host.txt` was copied. Installing rsync and re-running the copy fixed it, and `deploy.sh` now installs rsync itself.
- **Intermittent 404s right after a reload.** Requests tested immediately after reloading nginx returned 404 on web-02 even though the config was correct. After checking the config, permissions and logs, I found it worked a moment later, so I believe nginx was still switching to its new workers. `deploy.sh` now waits two seconds before its final check.
- **Not exposing the Git folder.** Serving the full clone would have made `.git` reachable. I tried a deny rule, but the simpler and safer fix was to serve a separate copy that never contains it.
- **Wrong server name on a deploy.** Passing the wrong name to `deploy.sh` makes the footer show the wrong server, while the `X-Served-By` header (which comes from the real hostname) still looks right. I re-ran the script with the correct name and confirmed with `host.txt` on each server.

## Limitations
- The planting rules in `js/rules.js` are simple guideline thresholds for rainfall and temperature, not agronomic advice. Confirm decisions with a local agronomist.
- District coordinates point to each district's main town, so forecasts represent that location, not the whole district.
- The free Open-Meteo API has usage limits. Caching and the single combined request keep the app well within them.

## Credits
- Weather and geocoding data: [Open-Meteo](https://open-meteo.com/) (CC BY 4.0)
- Charts: [Chart.js](https://www.chartjs.org/) (MIT licence)
- Hosting: nginx and HAProxy on the course-provided servers
- AI assistance: I used Claude (Anthropic) to help plan, scaffold and debug this project. I tested, deployed and adapted the result myself. TODO: check the course's policy on AI assistance and edit this line if needed.

## Author
Alain (GitHub: [Kaylain7](https://github.com/Kaylain7)), African Leadership University.
