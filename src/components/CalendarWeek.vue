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
    <div class="table-wrap" ref="wrap">
      <div class="scroll-content" ref="scrollContent">
        <table ref="table">
          <thead ref="thead">
            <tr>
              <th class="time-spacer" aria-hidden="true" role="presentation"></th>

              <th v-for="day in weekDays" :key="day.iso" :class="{ 'today-header': day.isToday }">
                <div class="th-wrap">
                  <div class="th-day">{{ day.weekdayShort }}</div>
                  <div class="th-date">{{ day.monthShort }} {{ day.dayNum }}</div>
                </div>
              </th>
            </tr>
          </thead>

          <tbody ref="tbody">
            <tr v-for="slot in timeSlots" :key="slot.isoTime">
              <th class="time-col" :class="{ 'is-hour': slot.isHour }" scope="row">
                <span v-if="slot.isHour">{{ slot.label }}</span>
              </th>

              <td
                v-for="day in weekDays"
                :key="day.iso + '-' + slot.isoTime"
                :class="[{ today: day.isToday }, 'slot', { 'slot-hour': slot.isHour }]"
                :data-time="slot.isoTime"
              ></td>
            </tr>
          </tbody>
        </table>

        <div class="events-layer" aria-label="events">
          <div
            v-for="occ in positionedOccurrences"
            :key="occ.id"
            class="event-block"
            :style="occ._style"
            :title="occ._tooltip"
            :class="{
              'is-cancelled': occ.status === 'cancelled',
              'is-override': !!occ.isOverride,
            }"
          >
            <div class="event-title">{{ occ.title }}</div>
            <div class="event-time">{{ occ._timeLabel }}</div>
          </div>
        </div>

        <div v-if="weekHasToday" class="now-line" :style="{ top: nowLineY + 'px' }"></div>
      </div>
    </div>
  </div>
</template>

<script>
import { collection, query, where, onSnapshot, getDocs, documentId, doc } from "firebase/firestore";
import { db } from "@/firebase/firebaseClient";

const TIME_SLOTS = (() => {
  const slots = [];
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 30) {
      const isHour = m === 0;
      const isoTime = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;

      const hour12 = ((h + 11) % 12) + 1;
      const label = isHour ? `${hour12}${h < 12 ? "am" : "pm"}` : "";

      slots.push({ h, m, isHour, label, isoTime });
    }
  }
  return slots;
})();

export default {
  name: "WeeklyCalendar",

  data() {
    return {
      currentDate: new Date(),
      nowLineY: 0,
      _nowLineTimer: null,

      occurrences: [],
      _unsubOccurrences: null,

      eventsById: Object.create(null),

      _rowHeight: 50,
      _headerHeight: 60,
      _resizeObs: null,

      _subToken: 0,
      _isAlive: true,

      _calendarId: "qrxbW04Nr4Bu2OkbwAdl",
    };
  },

  computed: {
    weekStart() {
      const d = new Date(this.currentDate);
      const day = d.getDay(); // Sunday=0
      const start = new Date(d.getFullYear(), d.getMonth(), d.getDate() - day);
      start.setHours(0, 0, 0, 0);
      return start;
    },

    weekEnd() {
      const end = new Date(this.weekStart);
      end.setDate(end.getDate() + 7);
      return end;
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

    weekHasToday() {
      return this.weekDays.some((d) => d.isToday);
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
      return TIME_SLOTS;
    },

    positionedOccurrences() {
      const pxPerMinute = this._rowHeight / 30;
      const weekStartTs = this.weekStart.getTime();
      const weekEndTs = this.weekEnd.getTime();

      // Build day boundaries for fast day clipping
      const dayStarts = this.weekDays.map((d) => {
        const x = new Date(d.date);
        x.setHours(0, 0, 0, 0);
        return x.getTime();
      });
      const dayEnds = dayStarts.map((ts) => ts + 24 * 60 * 60 * 1000);

      // Group occurrences by day index (0-6), splitting multi-day events if necessary
      const perDay = Array.from({ length: 7 }, () => []);

      for (const occ of this.occurrences) {
        const start = occ._start ?? this.toDate(occ.startAt);
        const end = occ._end ?? this.toDate(occ.endAt);

        const startTs = start.getTime();
        const endTs = end.getTime();

        // ignore anything completely outside week
        if (endTs <= weekStartTs || startTs >= weekEndTs) continue;

        // Find day indices that this event touches
        for (let di = 0; di < 7; di++) {
          const ds = dayStarts[di];
          const de = dayEnds[di];

          // overlap with this day?
          if (startTs < de && endTs > ds) {
            const clippedStartTs = Math.max(startTs, ds);
            const clippedEndTs = Math.min(endTs, de);

            const startMins = (clippedStartTs - ds) / 60000;
            const endMins = (clippedEndTs - ds) / 60000;

            perDay[di].push({
              ...occ,
              _dayIndex: di,
              _start: start,
              _end: end,
              _clippedStartTs: clippedStartTs,
              _clippedEndTs: clippedEndTs,
              _startMins: startMins,
              _endMins: endMins,
            });
          }
        }
      }

      // Layout overlaps per day
      const laidOut = [];
      for (let di = 0; di < 7; di++) {
        const items = perDay[di];
        const laid = this.layoutOverlaps(items);
        laidOut.push(...laid);
      }

      // Convert to styles in 7-col grid
      const gutter = 6;
      const dayLeftPct = (dayIndex) => (dayIndex * 100) / 7;
      const dayWidthPct = 100 / 7;

      return laidOut.map((o) => {
        const top = o._startMins * pxPerMinute;
        const height = Math.max(18, (o._endMins - o._startMins) * pxPerMinute);

        // overlap columning (within day)
        const colCount = o._totalCols || 1;
        const colIndex = o._colIndex || 0;

        const withinDayWidthPct = dayWidthPct / colCount;
        const leftPct = dayLeftPct(o._dayIndex) + colIndex * withinDayWidthPct;

        const title = this.eventsById?.[o.eventId]?.title ?? o.title ?? "(untitled)";

        const timeLabel = `${this.formatHM(o._start)} - ${this.formatHM(o._end)}`;

        return {
          ...o,
          title,
          _timeLabel: timeLabel,
          _tooltip: `${title}\n${timeLabel}`,
          _style: {
            top: `${top}px`,
            height: `${height}px`,
            left: `calc(${leftPct}% + ${gutter}px)`,
            width: `calc(${withinDayWidthPct}% - ${gutter * 2}px)`,
          },
        };
      });
    },
  },

  methods: {
    async refreshForWeekChange({ scrollIfToday = true } = {}) {
      await this.$nextTick();
      this.measureCalendarGeometry();
      this.subscribeToWeekOccurrences();

      if (scrollIfToday && this.weekHasToday) {
        this.scrollToNowOffset();
        this.updateNowLine();
      }
    },

    today() {
      this.currentDate = new Date();
      this.refreshForWeekChange({ scrollIfToday: true });
    },

    prevWeek() {
      const d = new Date(this.currentDate);
      d.setDate(d.getDate() - 7);
      this.currentDate = d;
      this.refreshForWeekChange({ scrollIfToday: true });
    },

    nextWeek() {
      const d = new Date(this.currentDate);
      d.setDate(d.getDate() + 7);
      this.currentDate = d;
      this.refreshForWeekChange({ scrollIfToday: true });
    },

    scrollToNowOffset() {
      const wrap = this.$refs.wrap;
      const tbody = this.$refs.tbody;
      const thead = this.$refs.thead;
      if (!wrap || !tbody) return;

      const firstRow = tbody.querySelector("tr");
      const rowHeight = firstRow ? firstRow.getBoundingClientRect().height : this._rowHeight || 40;

      const now = new Date();
      const minutesNow = now.getHours() * 60 + now.getMinutes();
      const targetMinutes = Math.max(0, Math.min(1439, minutesNow - 180));
      const slotIndex = Math.floor(targetMinutes / 30);

      const cushion = 0.5 * rowHeight;
      const headerH = thead ? thead.getBoundingClientRect().height : this._headerHeight || 60;

      const y = slotIndex * rowHeight - headerH - cushion;
      const maxScroll = wrap.scrollHeight - wrap.clientHeight;
      wrap.scrollTop = Math.max(0, Math.min(maxScroll, y));
    },

    updateNowLine() {
      if (!this.weekHasToday) return;

      const tbody = this.$refs.tbody;
      const thead = this.$refs.thead;
      if (!tbody) return;

      const firstRow = tbody.querySelector("tr");
      const rowHeight = firstRow ? firstRow.getBoundingClientRect().height : this._rowHeight || 40;

      const now = new Date();
      const mins = now.getHours() * 60 + now.getMinutes();
      const roundedMins = mins - (mins % 30);
      const slotIndex = Math.floor(roundedMins / 30);

      const headerH = thead ? thead.getBoundingClientRect().height : this._headerHeight || 60;
      this.nowLineY = slotIndex * rowHeight + headerH;
    },

    measureCalendarGeometry() {
      const tbody = this.$refs.tbody;
      const thead = this.$refs.thead;
      const sc = this.$refs.scrollContent;

      const firstRow = tbody ? tbody.querySelector("tr") : null;
      if (firstRow) this._rowHeight = firstRow.getBoundingClientRect().height || 50;
      if (thead) this._headerHeight = thead.getBoundingClientRect().height || 60;

      if (sc) sc.style.setProperty("--header-h", `${this._headerHeight}px`);
    },

    subscribeToWeekOccurrences() {
      if (this._unsubOccurrences) {
        this._unsubOccurrences();
        this._unsubOccurrences = null;
      }

      const token = ++this._subToken;

      const weekStart = this.weekStart;
      const weekEnd = this.weekEnd;

      const calRef = doc(db, "calendars", this._calendarId);
      const occurrencesRef = collection(calRef, "occurrences");

      const q = query(
        occurrencesRef,
        where("startAt", "<", weekEnd),
        where("endAt", ">", weekStart),
      );

      this._unsubOccurrences = onSnapshot(
        q,
        async (snap) => {
          if (!this._isAlive || token !== this._subToken) return;

          const occs = snap.docs
            .map((d) => ({ id: d.id, ...d.data() }))
            .map((o) => ({
              ...o,
              _start: this.toDate(o.startAt),
              _end: this.toDate(o.endAt),
            }))
            .sort((a, b) => a._start - b._start);

          this.occurrences = occs;

          await this.hydrateEventTitles(occs);
        },
        (err) => {
          console.error("Error subscribing to week occurrences:", err);
        },
      );
    },

    async hydrateEventTitles(occurrences) {
      const needed = Array.from(
        new Set(
          occurrences
            .map((o) => o.eventId)
            .filter(Boolean)
            .filter((id) => !this.eventsById[id]),
        ),
      );

      if (needed.length === 0) return;

      const calRef = doc(db, "calendars", this._calendarId);
      const eventsRef = collection(calRef, "events");

      const chunkSize = 10;
      for (let i = 0; i < needed.length; i += chunkSize) {
        const chunk = needed.slice(i, i + chunkSize);
        const evQ = query(eventsRef, where(documentId(), "in", chunk));
        const evSnap = await getDocs(evQ);

        evSnap.forEach((evDoc) => {
          this.eventsById[evDoc.id] = evDoc.data();
        });
      }
    },

    toDate(v) {
      if (!v) return new Date(0);
      if (v instanceof Date) return v;
      if (typeof v?.toDate === "function") return v.toDate();
      return new Date(v);
    },

    formatHM(d) {
      const dt = d instanceof Date ? d : new Date(d);
      return dt.toLocaleTimeString("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });
    },

    layoutOverlaps(items) {
      const sorted = [...(items || [])].sort(
        (a, b) => a._startMins - b._startMins || a._endMins - b._endMins,
      );

      const clusters = [];
      let cluster = [];
      let clusterEnd = -Infinity;

      for (const item of sorted) {
        if (cluster.length === 0 || item._startMins < clusterEnd) {
          cluster.push(item);
          clusterEnd = Math.max(clusterEnd, item._endMins);
        } else {
          clusters.push(cluster);
          cluster = [item];
          clusterEnd = item._endMins;
        }
      }
      if (cluster.length) clusters.push(cluster);

      for (const c of clusters) {
        const colEnds = [];

        for (const item of c) {
          let placed = false;
          for (let col = 0; col < colEnds.length; col++) {
            if (item._startMins >= colEnds[col]) {
              item._colIndex = col;
              colEnds[col] = item._endMins;
              placed = true;
              break;
            }
          }

          if (!placed) {
            item._colIndex = colEnds.length;
            colEnds.push(item._endMins);
          }
        }

        const totalCols = colEnds.length;
        for (const item of c) item._totalCols = totalCols;
      }

      return sorted;
    },
  },

  mounted() {
    this._isAlive = true;

    this.$nextTick(() => {
      this.measureCalendarGeometry();
      this.subscribeToWeekOccurrences();

      if (this.weekHasToday) {
        this.scrollToNowOffset();
        this.updateNowLine();
      }

      if (window.ResizeObserver) {
        this._resizeObs = new ResizeObserver(() => {
          this.measureCalendarGeometry();
          if (this.weekHasToday) this.updateNowLine();
        });

        if (this.$refs.wrap) this._resizeObs.observe(this.$refs.wrap);
        if (this.$refs.thead) this._resizeObs.observe(this.$refs.thead);
        if (this.$refs.tbody) this._resizeObs.observe(this.$refs.tbody);
      } else {
        window.addEventListener("resize", this.measureCalendarGeometry);
      }

      this._nowLineTimer = setInterval(() => {
        if (!this.weekHasToday) return;
        this.updateNowLine();
      }, 60_000);
    });
  },

  beforeUnmount() {
    this._isAlive = false;

    if (this._nowLineTimer) {
      clearInterval(this._nowLineTimer);
      this._nowLineTimer = null;
    }

    if (this._unsubOccurrences) {
      this._unsubOccurrences();
      this._unsubOccurrences = null;
    }

    if (this._resizeObs) {
      this._resizeObs.disconnect();
      this._resizeObs = null;
    } else {
      window.removeEventListener("resize", this.measureCalendarGeometry);
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

.scroll-content {
  position: relative;
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
  width: 70px;
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
  z-index: 8;
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

.events-layer {
  position: absolute;
  top: var(--header-h);
  left: 70px; /* starts after time column */
  right: 0;
  z-index: 4;
  pointer-events: none;
}

/* Current time horizontal line */
.now-line {
  position: absolute;
  left: 70px;
  right: 0;
  height: 2px;
  background: red;
  z-index: 5;
  pointer-events: none;
}

.event-block {
  position: absolute;
  margin: 2px 6px;
  border-radius: 8px;
  padding: 6px 8px;
  background: rgba(64, 158, 255, 0.85);
  color: white;
  overflow: hidden;
  pointer-events: auto;
  border: 1px solid rgba(255, 255, 255, 0.18);
}

.event-title {
  font-weight: 700;
  font-size: 0.95em;
  line-height: 1.1;
}

.event-time {
  font-size: 0.8em;
  opacity: 0.9;
  margin-top: 4px;
}

.event-block.is-cancelled {
  opacity: 0.45;
  text-decoration: line-through;
}
</style>
