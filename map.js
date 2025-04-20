let map = L.map("map").setView([37.8, -96], 4);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(map);

let geojsonLayer;
let metrics = {};

// Load metrics and geojson data
fetch("metrics.json")
  .then(res => res.json())
  .then(data => {
    metrics = data;
    return fetch("geojson-counties-fips.json");
  })
  .then(res => res.json())
  .then(geojson => {
    geojsonLayer = L.geoJson(geojson, {
      style: feature => getStyle(feature, "Commute_Time"),
      onEachFeature: (feature, layer) => {
        const geoIdRaw = feature.properties.GEO_ID;
        const fips = geoIdRaw ? geoIdRaw.slice(-5) : null;
        const val = metrics[fips];
        const countyName = feature.properties.NAME;

        if (val) {
          const commute = isValid(val.Commute_Time) ? `${val.Commute_Time} mins` : "No data";
          const transit = isValid(val.Transit_Time) ? `${val.Transit_Time} mins` : "No data";
          const driving = isValid(val.Driving_Time) ? `${val.Driving_Time} mins` : "No data";
          const ratio = isValid(val.ratio, "ratio", val)
            ? `${val.ratio.toFixed(2)}`
            : "No data";

          const popupContent = `
            <strong>${countyName} County</strong><br/>
            Commute: ${commute}<br/>
            Transit: ${transit}<br/>
            Driving: ${driving}<br/>
            Ratio: ${ratio}
          `;
          layer.bindPopup(popupContent);
        }
      }
    }).addTo(map);

    legend.addTo(map);
  });

// Get styling for a feature
function getStyle(feature, metric) {
  const geoIdRaw = feature.properties.GEO_ID;
  const fips = geoIdRaw ? geoIdRaw.slice(-5) : null;
  const raw = metrics[fips];
  const val = raw?.[metric];

  const isDataValid = isValid(val, metric, raw);
  return {
    fillColor: isDataValid ? getColor(val, metric) : "#ccc",
    weight: 0.1,
    color: "#fff",
    fillOpacity: 0.5
  };
}

// Determine color for value
function getColor(val, metric) {
  const thresholds = {
    Transit_Time: [10, 20, 30, 40, 50],
    Driving_Time: [10, 20, 30, 40, 50],
    Commute_Time: [10, 20, 30, 40, 50],
    ratio: [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.25]
  }[metric];

  const colors = [
    "#e6f5d0", // light green
    "#b8e186",
    "#7fbc41",
    "#4d9221",
    "#ffeda0",
    "#feb24c",
    "#f03b20",
    "#bd0026",
    "#800026"  // darkest red
  ];

  for (let i = 0; i < thresholds.length; i++) {
    if (val < thresholds[i]) return colors[i];
  }
  return colors[colors.length - 1];
}

// Check for valid number (general or ratio-aware)
function isValid(value, metric = null, raw = null) {
  if (metric === "ratio") {
    return (
      raw &&
      isValid(raw.Transit_Time) &&
      isValid(raw.Driving_Time) &&
      typeof raw.ratio === "number" &&
      raw.ratio >= 0 &&
      isFinite(raw.ratio)
    );
  }
  return typeof value === "number" && value >= 0 && isFinite(value);
}

// Update style + legend when metric changes
document.getElementById("metric").addEventListener("change", e => {
  const selectedMetric = e.target.value;
  geojsonLayer.eachLayer(layer => {
    const style = getStyle(layer.feature, selectedMetric);
    layer.setStyle(style);
  });

  // Refresh legend
  map.removeControl(legend);
  legend.addTo(map);
});

// Create legend
const legend = L.control({ position: "bottomright" });

legend.onAdd = function () {
  const div = L.DomUtil.create("div", "info legend bg-white bg-opacity-90 p-3 text-sm rounded shadow");
  const metric = document.getElementById("metric").value;

  const thresholds = {
    Transit_Time: [10, 20, 30, 40, 50],
    Driving_Time: [10, 20, 30, 40, 50],
    Commute_Time: [10, 20, 30, 40, 50],
    ratio: [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.25]
  }[metric];

  const labels = [];

  for (let i = 0; i < thresholds.length; i++) {
    const from = thresholds[i];
    const to = thresholds[i + 1];
    labels.push(
      `<i style="background:${getColor(from, metric)}; width: 18px; height: 18px; display: inline-block; margin-right: 6px;"></i>` +
      `${from}${to ? ` – ${to}` : "+"}`
    );
  }

  labels.push(
    `<i style="background:#ccc; width: 18px; height: 18px; display: inline-block; margin-right: 6px;"></i>No data`
  );

  div.innerHTML = `<div class="mb-1 font-medium text-gray-700">Legend (${metric.replace("_", " ")}):</div>` + labels.join("<br>");
  return div;
};
