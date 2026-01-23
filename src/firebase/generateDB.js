// src/firebase/generateDB.js
import { writeBatch, doc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "./firebaseClient";

/**
 * Creates:
 *   calendars/{calendarId}
 *   calendars/{calendarId}/members/{uid}
 *
 * @param {object} params
 * @param {string} params.uid
 * @param {string} params.name
 * @param {string} [params.timezone="Europe/Dublin"]
 * @returns {Promise<{ calendarId: string }>}
 */
export async function createCalendarWithOwner({ uid, name, timezone = "Europe/Dublin" }) {
  if (!uid) throw new Error("Missing uid (user must be signed in).");
  if (!name || !name.trim()) throw new Error("Calendar name is required.");

  const calendarRef = doc(collection(db, "calendars")); // auto-id
  const memberRef = doc(db, "calendars", calendarRef.id, "members", uid);

  const batch = writeBatch(db);

  batch.set(calendarRef, {
    name: name.trim(),
    timezone,
    createdBy: uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  batch.set(memberRef, {
    role: "owner",
    joinedAt: serverTimestamp(),
    invitedBy: uid,
  });

  await batch.commit();

  return { calendarId: calendarRef.id };
}
