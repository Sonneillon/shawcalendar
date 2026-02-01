<template>
  <img :src="imageUrl" alt="Calendar Picture" height="100%" width="98%" />
</template>

<script>
import { ref } from "vue";

const year = String(new Date().getFullYear());

const modules = import.meta.glob("../assets/images/**/*.{jpeg,jpg}", {
  eager: true,
  import: "default",
});

const images = Object.entries(modules)
  .filter(([path, _]) => path.includes(`/${year}/`))
  .map(([, src]) => src);

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
