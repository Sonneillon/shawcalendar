<script setup>
import CalendarView from "./views/CalendarView.vue";
import NewEventView from "./views/NewEventView.vue";
import ClockDisplay from "./components/ClockDisplay.vue";
import CalendarPicture from "./components/CalendarPicture.vue";
import ShawLogoBlue from "./components/ShawLogo.vue";

//import { RouterLink, RouterView } from 'vue-router'
import { ref } from "vue";
import { auth } from "@/firebase/firebaseClient";
import { signInWithEmailAndPassword } from "firebase/auth";
import { createTestEvent } from "@/firebase/createTestEvent";

const email = ref("");
const password = ref("");

async function addTestEvent() {
  const user = auth.currentUser;
  if (!user) return alert("Sign in first");

  await createTestEvent({
    calendarId: "qrxbW04Nr4Bu2OkbwAdl",
    uid: user.uid,
  });

  alert("Test event created");
}

async function signIn() {
  await signInWithEmailAndPassword(auth, email.value, password.value);
  alert("Signed in!");
}
</script>

<template>
  <main class="app">
    <div class="Layout-header">
      <ClockDisplay class="clock-wrapper" />

      <div style="padding: 24px; display: flex; flex-direction: column; gap: 8px">
        <input v-model="email" placeholder="email" />
        <input v-model="password" type="password" placeholder="password" />
        <button @click="signIn">Sign in</button>
      </div>
    </div>

    <div class="Layout-Media">
      <simpleKeyboard />
      <CalendarPicture />
    </div>

    <div class="Layout-calendar">
      <el-button type="warning" @click="addTestEvent">Create Test Event</el-button>

      <CalendarView />
    </div>
    <div class="Layout-footer">
      <ShawLogoBlue />
    </div>
  </main>
</template>

<style scoped>
.clock-wrapper {
  position: absolute;
  top: 10px;
  left: 10px;
  /*background-color: var(--color-background);*/
}

.Layout-header {
  position: fixed;
  height: 15%;
  width: 100vw;
  color: var(--color-heading);
  z-index: 2;
}

.Layout-Media {
  position: fixed;
  height: 50%;
  z-index: 1;
}

.Layout-calendar {
  position: fixed;
  top: 50%;
  width: 96vw;
  z-index: 2;
}

.Layout-footer {
  position: fixed;
  top: 92%;
  height: 50%;
  width: 96vw;
  z-index: 2;
}

@media (min-width: 1024px) {
  .Layout-header {
    display: block;
    place-items: center;
    padding-right: calc(var(--section-gap) / 2);
  }
}
</style>
