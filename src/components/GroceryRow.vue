<script setup>
defineProps(['item'])
defineEmits(['toggle', 'remove'])
</script>

<template>
  <li class="flex items-center gap-3 rounded-lg bg-white px-4 py-3 shadow-sm">
    <input
      type="checkbox"
      :checked="item.checked"
      @change="$emit('toggle', item.id)"
      class="h-5 w-5 rounded border-gray-300 text-green-600 focus:ring-green-500"
    />
    <span
      class="flex-1"
      :class="item.checked ? 'text-gray-400 line-through' : 'text-gray-900'"
    >
      {{ item.name }}
    </span>
    <button
      @click="$emit('remove', item.id)"
      class="text-gray-300 hover:text-red-500"
    >
      &times;
    </button>
  </li>
</template>