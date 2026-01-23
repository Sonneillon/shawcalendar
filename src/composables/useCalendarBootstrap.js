// src/composables/useCalendarBootstrap.js
import { auth } from "@/firebase/firebaseClient";
import { createCalendarWithOwner } from "@/firebase/generateDB";

/**
 * Simple wrapper for Vue usage.
 */
export function useCalendarBootstrap() {
  async function bootstrapCalendar(name = "Family Calendar") {
    const user = auth.currentUser;
    if (!user) throw new Error("You must be signed in.");

    return await createCalendarWithOwner({
      uid: user.uid,
      name,
      timezone: "Europe/Dublin",
    });
  }

  return { bootstrapCalendar };
}
