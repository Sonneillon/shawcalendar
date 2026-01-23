<template>
  <div class="calendar">
    <div class="calendar-header">
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
            v-for="(date, dIdx) in week"
            :key="dIdx"
            :style="{ height: cellHeight + 'px' }"
            :class="[
              { 'not-current-month': !date.isCurrentMonth },
              { today: date.isToday },
              { selected: date.isSelected },
            ]"
            @click="date.day && onDayClick(date)"
          >
            <span v-if="date.day">{{ date.day }}</span>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script>
export default {
  name: "CalendarComponent",

  props: {
    // passed from CalendarView as :selected-date="selectedDate"
    selectedDate: {
      type: Date,
      default: () => new Date(),
    },
  },

  data() {
    return {
      // show month of selectedDate by default (instead of always "today")
      currentDate: new Date(this.selectedDate),
      daysOfWeek: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
    };
  },

  watch: {
    // if parent changes selectedDate, month jumps to that month (handy when returning from Day/Week)
    selectedDate: {
      immediate: true,
      handler(newVal) {
        this.currentDate = new Date(newVal);
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
        week.push({
          day: null,
          isCurrentMonth: false,
          isToday: false,
          isSelected: false,
          date: null,
        });
      }

      // Fill days of the month
      for (let day = 1; day <= lastDay.getDate(); day++) {
        const cellDate = new Date(this.year, this.month, day);
        cellDate.setHours(0, 0, 0, 0);

        const isToday = cellDate.getTime() === today.getTime();
        const isSelected = cellDate.getTime() === selected.getTime();

        week.push({
          day,
          date: cellDate, // <-- real Date for click handling
          isCurrentMonth: true,
          isToday,
          isSelected,
        });

        if (week.length === 7) {
          weeks.push(week);
          week = [];
        }
      }

      // Fill trailing empty cells
      if (week.length) {
        while (week.length < 7) {
          week.push({
            day: null,
            isCurrentMonth: false,
            isToday: false,
            isSelected: false,
            date: null,
          });
        }
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
  },
  methods: {
    onDayClick(cell) {
      // keep parent in sync and switch to day view
      this.$emit("update:selected-date", cell.date);
      this.$emit("open-day", cell.date);
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
  color: white;
  font-weight: bold;
}
table {
  width: 100%;
  border-collapse: collapse;
}
.today {
  border: 2px solid skyblue;
  border-radius: 8px;
  color: skyblue;
  font-weight: 1200;
  font-size: 1.2em;
  background-color: rgba(135, 206, 235, 0.2);
}
td {
  width: 14.28%;
  /*height: 110px;*/
  text-align: left;
  vertical-align: top;
  padding: 10px;
  border: 1px solid #ddd;
}
th {
  font-size: 1.5em;
  width: 14.28%;
  height: 50px;
  text-align: center;
  border: 1px solid #ddd;
}
.not-current-month {
  color: #ccc;
}
</style>
