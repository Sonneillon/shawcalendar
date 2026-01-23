<template>
  <el-select
    class="range-picker"
    v-model="selected"
    style="width: 150px"
    placeholder="Select range"
  >
    <el-option
      v-for="item in rangeOptions"
      :key="item.value"
      :label="item.label"
      :value="item.value"
    ></el-option>
  </el-select>
</template>

<script setup>
//import { ref } from 'vue'
const selected = defineModel({
  type: String,
  default: "Month",
});

// options for the select
const rangeOptions = [
  { value: "Month", label: "Month" },
  { value: "Week", label: "Week" },
  { value: "Day", label: "Day" },
];
</script>
