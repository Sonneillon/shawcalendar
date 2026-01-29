<template>
  <div class="clock">
    <div class="timeRow">
      <h1 class="timeMain">{{ hh }}:{{ mm }}</h1>
      <h3 class="timeSec">{{ ss }}</h3>
    </div>
    <p class="date">{{ weekday }}, {{ day }} {{ month }}</p>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from "vue";

const hh = ref("00");
const mm = ref("00");
const ss = ref("00");
const weekday = ref("");
const day = ref("00");
const month = ref("");

let timerId;

function pad(n) {
  return String(n).padStart(2, "0");
}

function update() {
  const now = new Date();

  // Time
  hh.value = pad(now.getHours());
  mm.value = pad(now.getMinutes());
  ss.value = pad(now.getSeconds());

  // Date
  weekday.value = now.toLocaleDateString("en-US", { weekday: "long" });
  day.value = now.getDate();
  month.value = now.toLocaleDateString("en-US", { month: "long" });

  // schedule next tick at the next second boundary
  const msToNextSecond = 1000 - now.getMilliseconds();
  timerId = setTimeout(update, msToNextSecond);
}

onMounted(update);
onUnmounted(() => clearTimeout(timerId));
</script>

<style scoped>
.clock {
  display: block;
  width: auto !important;
  max-width: 100%;
  flex: 0 0 auto !important;
  grid-column: 1 / -1 !important;
  column-span: all;
  float: none;
  color: var(--color-clock);
  text-shadow:
    15px 15px 30px var(--color-shaw),
    7px 7px 15px var(--color-shaw);
}

.timeRow {
  display: flex;
  align-items: flex-start;
  gap: 0.25rem;
}

.timeMain,
.timeSec {
  margin: 0;
  line-height: 1;
  font-variant-numeric: tabular-nums;
  flex: 0 0 auto; /* don't grow to fill */
}

.timeMain {
  font-size: clamp(48px, 12vw, 160px);
  font-weight: 700;
}

.timeSec {
  font-size: clamp(16px, 4vw, 48px);
  font-weight: 600;
}

.date {
  margin: 0.25rem 0 0;
  font-size: clamp(14px, 3vw, 32px);
  font-weight: 500;
  text-align: center;
  text-shadow:
    15px 15px 30px var(--color-shaw),
    7px 7px 15px var(--color-shaw);
}
</style>
