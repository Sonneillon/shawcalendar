<template>
  <div class="clock">
    <div class="timeRow">
      <h1 class="timeMain">{{ time.hh }}:{{ time.mm }}</h1>
      <h3 class="timeSec">{{ time.ss }}</h3>
    </div>
    <p class="date">{{ time.weekday }}, {{ time.day }} {{ time.month }}</p>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from "vue";

const now = ref(new Date());
let intervalId;

const time = computed(() => ({
  hh: String(now.value.getHours()).padStart(2, "0"),
  mm: String(now.value.getMinutes()).padStart(2, "0"),
  ss: String(now.value.getSeconds()).padStart(2, "0"),
  weekday: now.value.toLocaleDateString("en-GB", { weekday: "long" }),
  day: String(now.value.getDate()).padStart(2, "0"),
  month: now.value.toLocaleDateString("en-GB", { month: "long" }),
}));

onMounted(() => {
  // align first tick to the next second boundary
  const startDelay = 1000 - now.value.getMilliseconds();

  const start = () => {
    now.value = new Date();
    intervalId = setInterval(() => {
      now.value = new Date();
    }, 1000);
  };

  setTimeout(start, startDelay);
});

onUnmounted(() => {
  clearInterval(intervalId);
});
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
