import { addDoc, collection, doc, setDoc, serverTimestamp, Timestamp } from "firebase/firestore";
import { db } from "@/firebase/firebaseClient";

export async function createTestEvent({ calendarId, uid }) {
  // 1) Create master event
  const eventRef = await addDoc(collection(db, "calendars", calendarId, "events"), {
    title: "Test Event",
    isRecurring: false,
    createdBy: uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  // 2) Create occurrence (today, 1 hour)
  const start = new Date();
  start.setMinutes(0, 0, 0);
  const end = new Date(start);
  end.setHours(end.getHours() + 1);

  await setDoc(doc(db, "calendars", calendarId, "occurrences", eventRef.id), {
    eventId: eventRef.id,
    startAt: Timestamp.fromDate(start),
    endAt: Timestamp.fromDate(end),
    status: "active",
    isOverride: false,
    createdAt: serverTimestamp(),
  });
}
