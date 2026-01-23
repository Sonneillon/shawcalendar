<template>
  <img :src="imageUrl" alt="Calendar Picture" height="100%" width="98%" />
</template>

<script>
import { ref } from "vue";

import LiliaDadCarry from "../assets/images/LiliaDadCarry.jpeg";
import LiliaLokiBed from "../assets/images/LiliaLokiBed.jpeg";
import LiliaLokiCouch from "../assets/images/LiliaLokiCouch.jpeg";
import LiliaLokiMumPose from "../assets/images/LiliaLokiMumPose.jpeg";
import LiliaLokiRed from "../assets/images/LiliaLokiRed.jpeg";
import LiliaLokiSleeping from "../assets/images/LiliaLokiSleeping.jpeg";
import LiliaLokiTummyTime from "../assets/images/LiliaLokiTummyTime.jpeg";
import LiliaLokiTummyTime2 from "../assets/images/LiliaLokiTummyTime2.jpeg";
import LiliaSleeping from "../assets/images/LiliaSleeping.jpeg";
import LiliaTummyTime from "../assets/images/LiliaTummyTime.jpeg";
import LokiBlueyPlay from "../assets/images/LokiBlueyPlay.jpg";
import LokiDadReading from "../assets/images/LokiDadReading.jpeg";
import LokiTiger from "../assets/images/LokiTiger.jpeg";

const images = [
  LiliaDadCarry,
  LiliaLokiBed,
  LiliaLokiCouch,
  LiliaLokiMumPose,
  LiliaLokiRed,
  LiliaLokiSleeping,
  LiliaLokiTummyTime,
  LiliaLokiTummyTime2,
  LiliaSleeping,
  LiliaTummyTime,
  LokiBlueyPlay,
  LokiDadReading,
  LokiTiger,
];

const randomImage = ref(images[Math.floor(Math.random() * images.length)]);

export default {
  name: "CalendarPicture",
  data() {
    return {
      imageUrl: randomImage.value,
    };
  },
};
</script>

<style scoped></style>
