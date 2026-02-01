<template>
  <div class="metoffice-card">
    <header class="header">
      <div class="title">
        <div class="location">{{ locationName }}</div>
        <div class="sub">
          <span v-if="observationTime">Updated: {{ observationTime }}</span>
          <span v-else>&nbsp;</span>
        </div>
      </div>

      <button class="btn" @click="load" :disabled="loading">
        {{ loading ? "Loading…" : "Refresh" }}
      </button>
    </header>

    <div v-if="error" class="error">
      {{ error }}
    </div>

    <div v-else class="content">
      <div class="icon" :title="weatherText">
        {{ weatherEmoji }}
      </div>

      <div class="temp">
        <span class="tempValue">{{ tempDisplay }}</span>
        <span class="tempUnit">°C</span>
      </div>

      <div class="desc">
        {{ weatherText }}
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from "vue";

// If you set a Hosting rewrite, you can keep this default.
// Otherwise pass the full Cloud Functions URL via the `endpoint` prop.
const props = defineProps({
  endpoint: {
    type: String,
    default: "/metofficeForecast",
  },
});

const loading = ref(false);
const error = ref(null);
const raw = ref(null);

function safeGet(obj, path, fallback) {
  let cur = obj;
  for (const key of path) {
    if (cur && typeof cur === "object" && key in cur) cur = cur[key];
    else return fallback;
  }
  return cur ?? fallback;
}

// Weather code → text + emoji.
// (Codes align with Met Office code definitions commonly used across products.)
const WEATHER_CODE = {
  0: { text: "Clear night", emoji: "🌙" },
  1: { text: "Sunny day", emoji: "☀️" },
  2: { text: "Partly cloudy (night)", emoji: "🌙☁️" },
  3: { text: "Partly cloudy (day)", emoji: "⛅" },
  5: { text: "Mist", emoji: "🌫️" },
  6: { text: "Fog", emoji: "🌫️" },
  7: { text: "Cloudy", emoji: "☁️" },
  8: { text: "Overcast", emoji: "☁️" },
  9: { text: "Light rain shower (night)", emoji: "🌧️🌙" },
  10: { text: "Light rain shower (day)", emoji: "🌦️" },
  11: { text: "Drizzle", emoji: "🌦️" },
  12: { text: "Light rain", emoji: "🌧️" },
  13: { text: "Heavy rain shower (night)", emoji: "⛈️🌙" },
  14: { text: "Heavy rain shower (day)", emoji: "⛈️" },
  15: { text: "Heavy rain", emoji: "🌧️" },
  16: { text: "Sleet shower (night)", emoji: "🌨️🌙" },
  17: { text: "Sleet shower (day)", emoji: "🌨️" },
  18: { text: "Sleet", emoji: "🌨️" },
  19: { text: "Hail shower (night)", emoji: "🌨️🌙" },
  20: { text: "Hail shower (day)", emoji: "🌨️" },
  21: { text: "Hail", emoji: "🌨️" },
  22: { text: "Light snow shower (night)", emoji: "❄️🌙" },
  23: { text: "Light snow shower (day)", emoji: "❄️" },
  24: { text: "Light snow", emoji: "❄️" },
  25: { text: "Heavy snow shower (night)", emoji: "🌨️🌙" },
  26: { text: "Heavy snow shower (day)", emoji: "🌨️" },
  27: { text: "Heavy snow", emoji: "🌨️" },
  28: { text: "Thunder shower (night)", emoji: "⛈️🌙" },
  29: { text: "Thunder shower (day)", emoji: "⛈️" },
  30: { text: "Thunder", emoji: "⛈️" },
};

const firstTimeseriesEntry = computed(() => {
  const m = raw.value?.metOffice;
  return safeGet(m, ["features", "0", "properties", "timeSeries", "0"], null);
});

const temperature = computed(() => {
  const t = firstTimeseriesEntry.value;
  if (!t) return null;

  if (typeof t.maxScreenAirTemp === "number") return t.maxScreenAirTemp;
  if (typeof t.screenAirTemp === "number") return t.screenAirTemp;
  if (typeof t.feelsLikeTemp === "number") return t.feelsLikeTemp;

  return null;
});

const tempDisplay = computed(() => {
  const t = temperature.value;
  return typeof t === "number" ? t.toFixed(1) : "—";
});

const weatherCode = computed(() => {
  const t = firstTimeseriesEntry.value;
  if (!t) return null;
  return typeof t.significantWeatherCode === "number" ? t.significantWeatherCode : null;
});

const weatherText = computed(() => {
  const code = weatherCode.value;
  if (code === null) return "—";
  return (WEATHER_CODE[code] && WEATHER_CODE[code].text) || `Weather code ${code}`;
});

const weatherEmoji = computed(() => {
  const code = weatherCode.value;
  if (code === null) return "❔";
  return (WEATHER_CODE[code] && WEATHER_CODE[code].emoji) || "❔";
});

const locationName = computed(() => {
  const m = raw.value?.metOffice;
  const props0 = safeGet(m, ["features", "0", "properties"], {});
  const name =
    props0.locationName ||
    props0.siteName ||
    props0.name ||
    (props0.location && (props0.location.name || props0.location.title));

  if (typeof name === "string" && name.trim()) return name.trim();

  const lat = raw.value?.latitude;
  const lon = raw.value?.longitude;
  if (typeof lat === "number" && typeof lon === "number") {
    return `Lat ${lat.toFixed(4)}, Lon ${lon.toFixed(4)}`;
  }
  return "Forecast";
});

const observationTime = computed(() => {
  const t = firstTimeseriesEntry.value;
  const iso = t && t.time;
  if (typeof iso !== "string") return "";
  return iso.replace("T", " ").replace("Z", " UTC");
});

async function load() {
  loading.value = true;
  error.value = null;

  try {
    const res = await fetch(props.endpoint, { method: "GET" });

    const contentType = res.headers.get("content-type") || "";
    const text = await res.text();

    if (!res.ok) {
      throw new Error(`Request failed (${res.status}): ${text.slice(0, 200)}`);
    }
    if (!contentType.includes("application/json")) {
      throw new Error(`Expected JSON but got "${contentType}". First bytes: ${text.slice(0, 80)}`);
    }

    raw.value = JSON.parse(text);
  } catch (e) {
    error.value = e && e.message ? e.message : String(e);
  } finally {
    loading.value = false;
  }
}

onMounted(load);
</script>

<style scoped>
.metoffice-card {
  max-width: 360px;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 14px;
  font-family:
    system-ui,
    -apple-system,
    Segoe UI,
    Roboto,
    Arial,
    sans-serif;
}

.header {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: start;
  margin-bottom: 10px;
}

.location {
  font-weight: 700;
  font-size: 16px;
  line-height: 1.2;
}

.sub {
  color: #6b7280;
  font-size: 12px;
  margin-top: 2px;
}

.btn {
  border: 1px solid #d1d5db;
  border-radius: 10px;
  padding: 8px 10px;
  background: white;
  cursor: pointer;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.error {
  color: #b91c1c;
  background: #fef2f2;
  border: 1px solid #fecaca;
  padding: 10px;
  border-radius: 10px;
  font-size: 13px;
}

.content {
  display: grid;
  grid-template-columns: 52px 1fr;
  grid-template-rows: auto auto;
  column-gap: 12px;
  row-gap: 4px;
  align-items: center;
}

.icon {
  font-size: 38px;
  grid-row: 1 / span 2;
  display: flex;
  justify-content: center;
}

.temp {
  display: flex;
  align-items: baseline;
  gap: 4px;
}

.tempValue {
  font-size: 34px;
  font-weight: 800;
}

.tempUnit {
  font-size: 14px;
  color: #6b7280;
  font-weight: 600;
}

.desc {
  font-size: 13px;
  color: #374151;
}
</style>
