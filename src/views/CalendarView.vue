<script setup>
import { ref, computed, markRaw } from "vue";
import RangePicker from "@/components/RangePicker.vue";
import CalendarMonth from "@/components/CalendarMonth.vue";
import CalendarWeek from "@/components/CalendarWeek.vue";
import CalendarDay from "@/components/CalendarDay.vue";

const selectedRange = ref("Month");
const selectedDate = ref(new Date());
const dayOpenedFromMonth = ref(false);

const componentMap = {
  Week: markRaw(CalendarWeek),
  Month: markRaw(CalendarMonth),
  Day: markRaw(CalendarDay),
};

const calendarComponent = computed(() => componentMap[selectedRange.value] || CalendarMonth);

function openDay(date) {
  selectedDate.value = new Date(date);
  dayOpenedFromMonth.value = true;
  selectedRange.value = "Day";
}

function updateSelectedDate(date) {
  selectedDate.value = new Date(date);
}

function onRangeChanged(next) {
  selectedRange.value = next;
  dayOpenedFromMonth.value = false;
}

function goToMonth() {
  selectedRange.value = "Month";
  dayOpenedFromMonth.value = false;
}
</script>

<template>
  <div class="Range-picker">
    <RangePicker :model-value="selectedRange" @update:modelValue="onRangeChanged" />
  </div>

  <div>
    <Suspense>
      <main>
        <component
          :is="calendarComponent"
          :selectedDate="selectedDate"
          :show-return-to-month="dayOpenedFromMonth"
          @openDay="openDay"
          @update:selectedDate="updateSelectedDate"
          @go-to-month="
            () => {
              selectedRange = 'Month';
              dayOpenedFromMonth = false;
            }
          "
        />
      </main>

      <template #fallback>
        <div>Loading weekly calendar data...</div>
      </template>
    </Suspense>
  </div>
</template>

<style></style>
