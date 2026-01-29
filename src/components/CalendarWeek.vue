<template>
  <div class="calendar">
    <div class="calendar-header">
      <h1>
        <span>{{ weekRange }}</span>
      </h1>
      <div class="buttons">
        <el-button type="info" @click="prevWeek">◄</el-button>
        <el-button type="success" @click="today">Today</el-button>
        <el-button type="info" @click="nextWeek">►</el-button>
      </div>
    </div>

    <!-- Table with sticky header + left time column and scrollable body -->
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <!-- Invisible spacer to keep columns aligned with the time column -->
            <th class="time-spacer" aria-hidden="true" role="presentation"></th>

            <!-- 7 weekday headers -->
            <th v-for="day in weekDays" :key="day.iso" :class="{ 'today-header': day.isToday }">
              <div class="th-wrap">
                <div class="th-day">{{ day.weekdayShort }}</div>
                <div class="th-date">{{ day.monthShort }} {{ day.dayNum }}</div>
              </div>
            </th>
          </tr>
        </thead>

        <tbody>
          <!-- 48 rows of 30-minute slots -->
          <tr v-for="slot in timeSlots" :key="slot.isoTime">
            <!-- Left sticky time cell: only label on the hour -->
            <th class="time-col" :class="{ 'is-hour': slot.isHour }" scope="row">
              <span v-if="slot.isHour">{{ slot.label }}</span>
            </th>

            <!-- 7 day x 48 row grid cells -->
            <td
              v-for="day in weekDays"
              :key="day.iso + '-' + slot.isoTime"
              :class="[{ today: day.isToday }, 'slot', { 'slot-hour': slot.isHour }]"
              :data-time="slot.isoTime"
            ></td>
          </tr>
        </tbody>
      </table>

      <!-- Current time line (rounded down to nearest 30) -->
      <div class="now-line" :style="{ top: nowLineY + 'px' }"></div>
    </div>
  </div>
</template>

<script>
export default {
  name: "WeeklyCalendar",
  data() {
    return {
      currentDate: new Date(),
      nowLineY: 0,
      _nowLineTimer: null,
    };
  },
  computed: {
    weekStart() {
      const d = new Date(this.currentDate);
      const day = d.getDay();
      const start = new Date(d.getFullYear(), d.getMonth(), d.getDate() - day);
      start.setHours(0, 0, 0, 0);
      return start;
    },
    weekDays() {
      const days = [];
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      for (let i = 0; i < 7; i++) {
        const date = new Date(this.weekStart);
        date.setDate(this.weekStart.getDate() + i);
        const isToday = date.getTime() === today.getTime();
        days.push({
          date,
          isToday,
          iso: date.toISOString().slice(0, 10),
          weekdayShort: date.toLocaleString("default", { weekday: "short" }),
          monthShort: date.toLocaleString("default", { month: "short" }),
          dayNum: date.getDate(),
        });
      }
      return days;
    },
    weekRange() {
      const start = this.weekDays[0].date;
      const end = this.weekDays[6].date;
      const startMonth = start.toLocaleString("default", { month: "short" });
      const endMonth = end.toLocaleString("default", { month: "short" });
      if (start.getFullYear() === end.getFullYear()) {
        return `${startMonth} ${start.getDate()} – ${endMonth} ${end.getDate()}, ${end.getFullYear()}`;
      }
      return `${startMonth} ${start.getDate()}, ${start.getFullYear()} – ${endMonth} ${end.getDate()}, ${end.getFullYear()}`;
    },
    timeSlots() {
      const slots = [];
      for (let h = 0; h < 24; h++) {
        for (let m = 0; m < 60; m += 30) {
          const isHour = m === 0;
          const date = new Date(2000, 0, 1, h, m);
          const label = isHour ? date.toLocaleTimeString([], { hour: "numeric" }) : "";
          const isoTime = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
          slots.push({ h, m, isHour, label, isoTime });
        }
      }
      return slots;
    },
  },
  methods: {
    today() {
      this.currentDate = new Date();
      this.$nextTick(() => {
        this.scrollToNowOffset();
        this.updateNowLine();
      });
    },
    prevWeek() {
      const d = new Date(this.currentDate);
      d.setDate(d.getDate() - 7);
      this.currentDate = d;
      this.$nextTick(() => {
        this.scrollToNowOffset();
        this.updateNowLine();
      });
    },
    nextWeek() {
      const d = new Date(this.currentDate);
      d.setDate(d.getDate() + 7);
      this.currentDate = d;
      this.$nextTick(() => {
        this.scrollToNowOffset();
        this.updateNowLine();
      });
    },
    scrollToNowOffset() {
      const wrap = this.$el.querySelector(".table-wrap");
      if (!wrap) return;
      const firstRow = this.$el.querySelector("tbody tr");
      const rowHeight = firstRow ? firstRow.getBoundingClientRect().height : 40;
      const now = new Date();
      const minutesNow = now.getHours() * 60 + now.getMinutes();
      const targetMinutes = Math.max(0, Math.min(1439, minutesNow - 180));
      const slotIndex = Math.floor(targetMinutes / 30);
      const cushion = 0.5 * rowHeight;
      const header = this.$el.querySelector("thead");
      const headerH = header ? header.getBoundingClientRect().height : 60;
      const y = slotIndex * rowHeight - headerH - cushion;
      const maxScroll = wrap.scrollHeight - wrap.clientHeight;
      wrap.scrollTop = Math.max(0, Math.min(maxScroll, y));
    },
    updateNowLine() {
      const wrap = this.$el.querySelector(".table-wrap");
      const firstRow = this.$el.querySelector("tbody tr");
      if (!wrap || !firstRow) return;
      const rowHeight = firstRow.getBoundingClientRect().height || 40;
      const now = new Date();
      const mins = now.getHours() * 60 + now.getMinutes();
      const roundedMins = mins - (mins % 30);
      const slotIndex = Math.floor(roundedMins / 30);
      const header = this.$el.querySelector("thead");
      const headerH = header ? header.getBoundingClientRect().height : 60;
      this.nowLineY = slotIndex * rowHeight + headerH;
    },
  },
  mounted() {
    this.$nextTick(() => {
      this.scrollToNowOffset();
      this.updateNowLine();
      this._nowLineTimer = setInterval(this.updateNowLine, 60_000);
    });
  },
  beforeUnmount() {
    if (this._nowLineTimer) {
      clearInterval(this._nowLineTimer);
      this._nowLineTimer = null;
    }
  },
};
</script>

<style scoped>
.calendar {
  max-width: 100%;
  margin: auto;
}
.calendar-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}
.buttons {
  display: flex;
  align-items: center;
  gap: 3rem;
  background: none;
  border: none;
  font-size: 1.5em;
  cursor: pointer;
  color: white;
}
h1 {
  font-size: 2.5em;
  color: var(--color-text);
  font-weight: bold;
}

/* ===== Table & Scrolling ===== */
.table-wrap {
  position: relative;
  max-height: 670px;
  overflow-y: auto;
  border: 1px solid #ddd;
  border-radius: 8px;
}

/* Keep header visible during vertical scroll */
table {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
  position: relative;
}
thead th {
  position: sticky;
  top: 0;
  z-index: 3;
  background: rgba(255, 255, 255, 0.08);
  backdrop-filter: blur(4px);
}

/* Invisible corner spacer that replaces the old "Time" header cell */
.time-spacer {
  position: sticky;
  left: 0;
  z-index: 3;
  width: 70px; /* same as time column width */
  min-width: 70px;
  max-width: 70px;
  border: none !important;
  background: transparent !important;
  padding: 0;
}

/* Column widths: time col + 7 equal day cols */
.time-col {
  width: 70px;
}
thead th:not(.time-spacer),
tbody td {
  width: calc((100% - 70px) / 7);
}

/* Borders */
th,
td {
  border: 1px solid #ddd;
}

/* Header cells */
thead th {
  height: 60px;
  text-align: center;
  font-size: 1.05em;
}
.th-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  line-height: 1.1;
}
.th-day {
  font-weight: 600;
}
.th-date {
  font-size: 0.95em;
  opacity: 0.9;
}

/* ===== Time column (left) sticky ===== */
.time-col {
  position: sticky;
  left: 0;
  z-index: 2;
  text-align: right;
  padding-right: 8px;
  background: rgba(255, 255, 255, 0.06);
  white-space: nowrap;
  font-size: 0.95em;
}
.time-col.is-hour {
  font-weight: 600;
}

/* ===== Time slots ===== */
tbody tr {
  height: 50px;
}
td.slot {
  position: relative;
  vertical-align: top;
  padding: 0;
}

/* subtle horizontal guide line at each full hour */
td.slot-hour {
  box-shadow: inset 0 1px 0 0 rgba(255, 255, 255, 0.12);
}

/* Today highlight */
td.today {
  border-left: 2px solid skyblue;
  border-right: 2px solid skyblue;
  background-color: rgba(135, 206, 235, 0.2);
}
thead th.today-header {
  border-bottom: 2px solid skyblue;
  background-color: skyblue;
  font-weight: 1200;
  font-size: 1.2em;
  color: black;
}

/* Hover feedback */
td.slot:hover {
  background: rgba(255, 255, 255, 0.05);
}

/* Current time horizontal line */
.now-line {
  position: absolute;
  left: 70px; /* width of time column */
  right: 0;
  height: 2px;
  background: red;
  z-index: 5;
  pointer-events: none;
}
</style>
