import { createRouter, createWebHistory } from "vue-router";
import CalendarView from "../views/CalendarView.vue";
import NewEventView from "../views/NewEventView.vue";

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: "/",
      name: "calendar",
      component: CalendarView,
    },
    {
      path: "/new-event",
      name: "New Event",
      component: NewEventView,
    },
  ],
});

export default router;
