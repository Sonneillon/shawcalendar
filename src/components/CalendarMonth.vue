<template>
  <div class="calendar">
    <div class="calendarHeader">
      <h1>
        <span>{{ monthName }} {{ year }}</span>
      </h1>
      <div class="buttons">
        <el-button type="info" @click="prevMonth">◄</el-button>
        <el-button type="success" @click="today">Today</el-button>
        <el-button type="info" @click="nextMonth">►</el-button>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th v-for="day in daysOfWeek" :key="day">{{ day }}</th>
        </tr>
      </thead>

      <tbody>
        <tr v-for="(week, wIdx) in weeks" :key="wIdx">
          <td
            v-for="(cell, dIdx) in week"
            :key="dIdx"
            :style="{ height: cellHeight + 'px' }"
            :class="[
              { 'not-current-month': !cell.isCurrentMonth },
              { today: cell.isToday },
              { selected: cell.isSelected },
            ]"
            @click="cell.day && onDayClick(cell)"
          >
            <div class="cell-inner" v-if="cell.day">
              <div class="cell-top">
                <span class="day-num">{{ cell.day }}</span>
              </div>

              <!-- Events stack -->
              <div class="cell-events">
                <template v-for="(ev, idx) in dayEvents(cell.iso)">
                  <button
                    v-if="idx < 3"
                    :key="ev.id"
                    class="event-chip"
                    :class="{
                      'is-cancelled': ev.status === 'cancelled',
                      'not-current-month': !cell.isCurrentMonth,
                    }"
                    type="button"
                    @click.stop="onEventClick(ev, cell)"
                    :title="ev._tooltip"
                  >
                    <span class="event-chip-title">{{ ev.title }}</span>
                  </button>
                </template>

                <button
                  v-if="moreCount(cell.iso) > 0"
                  class="more-chip"
                  type="button"
                  @click.stop="onMoreClick(cell)"
                >
                  +{{ moreCount(cell.iso) }} more
                </button>
              </div>
            </div>

            <span v-else class="empty-cell"></span>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script>
import { collection, query, where, onSnapshot, getDocs, documentId, doc } from "firebase/firestore";
import { db } from "@/firebase/firebaseClient";

export default {
  name: "CalendarComponent",

  props: {
    selectedDate: {
      type: Date,
      default: () => new Date(),
    },
  },

  data() {
    return {
      currentDate: new Date(this.selectedDate),
      daysOfWeek: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],

      // Firestore
      occurrences: [],
      _unsubOccurrences: null,
      _calendarId: "qrxbW04Nr4Bu2OkbwAdl",

      // Non-reactive-ish cache; if you’re on Vue 3 you can markRaw this
      eventsById: Object.create(null),

      _subToken: 0,
      _isAlive: true,
    };
  },

  watch: {
    selectedDate: {
      immediate: true,
      handler(newVal) {
        this.currentDate = new Date(newVal);
      },
    },

    // resubscribe when month changes
    monthRangeKey: {
      immediate: true,
      handler() {
        this.subscribeToMonthOccurrences();
      },
    },
  },

  computed: {
    year() {
      return this.currentDate.getFullYear();
    },
    month() {
      return this.currentDate.getMonth();
    },
    monthName() {
      return this.currentDate.toLocaleString("default", { month: "long" });
    },

    weeks() {
      const firstDay = new Date(this.year, this.month, 1);
      const lastDay = new Date(this.year, this.month + 1, 0);

      const weeks = [];
      let week = [];
      const startDow = firstDay.getDay();

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const selected = new Date(this.selectedDate);
      selected.setHours(0, 0, 0, 0);

      // Fill initial empty cells
      for (let i = 0; i < startDow; i++) {
        week.push(this.makeEmptyCell());
      }

      // Fill days of the month
      for (let day = 1; day <= lastDay.getDate(); day++) {
        const cellDate = new Date(this.year, this.month, day);
        cellDate.setHours(0, 0, 0, 0);

        week.push({
          day,
          date: cellDate,
          iso: cellDate.toISOString().slice(0, 10),
          isCurrentMonth: true,
          isToday: cellDate.getTime() === today.getTime(),
          isSelected: cellDate.getTime() === selected.getTime(),
        });

        if (week.length === 7) {
          weeks.push(week);
          week = [];
        }
      }

      // Fill trailing empty cells
      if (week.length) {
        while (week.length < 7) week.push(this.makeEmptyCell());
        weeks.push(week);
      }

      return weeks;
    },

    weeksInMonth() {
      return this.weeks.length;
    },

    cellHeight() {
      const heightFor6Weeks = 103;
      const totalGridHeight = heightFor6Weeks * 6;
      return Math.round(totalGridHeight / this.weeksInMonth);
    },

    // Range for subscription should include visible grid’s leading/trailing days
    visibleRange() {
      const allCells = this.weeks.flat().filter((c) => c.date);
      if (!allCells.length) {
        const a = new Date(this.year, this.month, 1);
        const b = new Date(this.year, this.month + 1, 1);
        return { start: a, end: b };
      }
      const start = new Date(allCells[0].date);
      start.setHours(0, 0, 0, 0);
      const end = new Date(allCells[allCells.length - 1].date);
      end.setDate(end.getDate() + 1);
      end.setHours(0, 0, 0, 0);
      return { start, end };
    },

    monthRangeKey() {
      const { start, end } = this.visibleRange;
      return `${start.toISOString().slice(0, 10)}_${end.toISOString().slice(0, 10)}`;
    },

    // Group occurrences by day ISO (YYYY-MM-DD), sorted by start time
    occurrencesByDay() {
      const map = Object.create(null);
      const { start: rangeStart, end: rangeEnd } = this.visibleRange;
      const rangeStartTs = rangeStart.getTime();
      const rangeEndTs = rangeEnd.getTime();

      for (const occ of this.occurrences) {
        const start = occ._start ?? this.toDate(occ.startAt);
        const end = occ._end ?? this.toDate(occ.endAt);

        const startTs = start.getTime();
        const endTs = end.getTime();

        if (endTs <= rangeStartTs || startTs >= rangeEndTs) continue;

        // Determine which days this occurrence touches (for multi-day)
        const firstDay = this.startOfDayTs(new Date(Math.max(startTs, rangeStartTs)));
        const lastDay = this.startOfDayTs(new Date(Math.min(endTs - 1, rangeEndTs - 1)));

        for (let dayTs = firstDay; dayTs <= lastDay; dayTs += 86400000) {
          const iso = new Date(dayTs).toISOString().slice(0, 10);
          (map[iso] ||= []).push({
            ...occ,
            _start: start,
            _end: end,
            title: this.eventsById?.[occ.eventId]?.title ?? occ.title ?? "(untitled)",
            _tooltip: this.makeTooltip(occ, start, end),
          });
        }
      }

      // sort each day bucket by actual start time
      for (const iso in map) {
        map[iso].sort((a, b) => a._start - b._start || a._end - b._end);
      }

      return map;
    },
  },

  methods: {
    makeEmptyCell() {
      return {
        day: null,
        isCurrentMonth: false,
        isToday: false,
        isSelected: false,
        date: null,
        iso: null,
      };
    },

    dayEvents(iso) {
      if (!iso) return [];
      return this.occurrencesByDay[iso] || [];
    },

    moreCount(iso) {
      const n = this.dayEvents(iso).length;
      return n > 3 ? n - 3 : 0;
    },

    onDayClick(cell) {
      this.$emit("update:selected-date", cell.date);
      this.$emit("open-day", cell.date);
    },

    onMoreClick(cell) {
      // Open the day view (or a popover) showing all events
      this.$emit("update:selected-date", cell.date);
      this.$emit("open-day", cell.date);
    },

    onEventClick(ev, cell) {
      // Parent can open a modal / drawer; include date context if useful
      this.$emit("open-event", { event: ev, day: cell.date });
    },

    prevMonth() {
      this.currentDate = new Date(this.year, this.month - 1, 1);
    },

    nextMonth() {
      this.currentDate = new Date(this.year, this.month + 1, 1);
    },

    today() {
      const d = new Date();
      this.currentDate = new Date(d);
      this.$emit("update:selected-date", d);
    },

    // ---------- Firestore ----------
    subscribeToMonthOccurrences() {
      if (this._unsubOccurrences) {
        this._unsubOccurrences();
        this._unsubOccurrences = null;
      }

      const token = ++this._subToken;
      const { start, end } = this.visibleRange;

      const calRef = doc(db, "calendars", this._calendarId);
      const occurrencesRef = collection(calRef, "occurrences");

      const q = query(occurrencesRef, where("startAt", "<", end), where("endAt", ">", start));

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
          console.error("Error subscribing to month occurrences:", err);
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

    // ---------- Utils ----------
    toDate(v) {
      if (!v) return new Date(0);
      if (v instanceof Date) return v;
      if (typeof v?.toDate === "function") return v.toDate();
      return new Date(v);
    },

    startOfDayTs(d) {
      const x = new Date(d);
      x.setHours(0, 0, 0, 0);
      return x.getTime();
    },

    formatHM(d) {
      const dt = d instanceof Date ? d : new Date(d);
      return dt.toLocaleTimeString("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });
    },

    makeTooltip(occ, start, end) {
      const title = this.eventsById?.[occ.eventId]?.title ?? occ.title ?? "(untitled)";
      return `${title}\n${this.formatHM(start)} - ${this.formatHM(end)}`;
    },
  },

  mounted() {
    this._isAlive = true;
  },

  beforeUnmount() {
    this._isAlive = false;
    if (this._unsubOccurrences) {
      this._unsubOccurrences();
      this._unsubOccurrences = null;
    }
  },
};
</script>

<style scoped>
.calendar {
  max-width: 100%;
  margin: auto;
}

.calendarHeader {
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

table {
  width: 100%;
  border-collapse: collapse;
}

th {
  font-size: 1.5em;
  width: 14.28%;
  height: 50px;
  text-align: center;
  border: 1px solid #ddd;
}

td {
  width: 14.28%;
  text-align: left;
  vertical-align: top;
  padding: 8px;
  border: 1px solid #ddd;
  overflow: hidden;
}

.not-current-month {
  color: #ccc;
}

.today {
  border: 2px solid skyblue;
  border-radius: 8px;
  color: skyblue;
  font-weight: 800;
  background-color: rgba(135, 206, 235, 0.2);
}

/* ---- Cell layout ---- */
.cell-inner {
  height: 100%;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.cell-top {
  display: flex;
  justify-content: flex-start;
  align-items: center;
  margin-bottom: 6px;
}

.day-num {
  font-weight: 700;
}

/* ---- Events stack ---- */
.cell-events {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-height: 0;
  flex: 1;
}

/* Uniform height “chips” */
.event-chip,
.more-chip {
  height: 18px; /* <- uniform height */
  line-height: 18px;
  border-radius: 6px;
  padding: 0 6px;
  font-size: 0.8em;
  text-align: left;
  border: 1px solid rgba(255, 255, 255, 0.18);
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  cursor: pointer;
  background: rgba(64, 158, 255, 0.85);
  color: white;
}

/* “+N more” style */
.more-chip {
  background: rgba(255, 255, 255, 0.12);
  color: var(--color-text);
  border: 1px dashed rgba(255, 255, 255, 0.25);
}

.event-chip.is-cancelled {
  opacity: 0.5;
  text-decoration: line-through;
}
</style>
