<script setup>
defineProps(['item', 'requirePrice'])
defineEmits(['toggle', 'remove', 'updatePrice'])
</script>

<template>
  <li class="flex items-center gap-3 rounded-lg bg-white px-4 py-3 shadow-sm">
    <input
      type="checkbox"
      :checked="item.checked"
      :disabled="requirePrice && !item.price"
      @change="$emit('toggle', item.id)"
      class="h-5 w-5 rounded border-gray-300 text-green-600 focus:ring-green-500 disabled:cursor-not-allowed disabled:opacity-30"
    />
    <span class="flex-1" :class="item.checked ? 'text-gray-400 line-through' : 'text-gray-900'">
      {{ item.name }}
    </span>
    <div class="relative">
      <span
        class="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-xs"
        :class="item.checked ? 'text-gray-300' : 'text-gray-400'"
      >₱</span>
      <input
        type="number"
        min="0"
        step="0.01"
        :value="item.price ? item.price.toFixed(2) : ''"
        placeholder="0.00"
        @change="$emit('updatePrice', item.id, parseFloat($event.target.value) || 0)"
        class="w-24 rounded border py-1 pl-5 pr-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
        :class="requirePrice && !item.price
          ? 'border-amber-400 bg-amber-50 text-gray-700 focus:border-amber-500'
          : item.checked
            ? 'border-gray-200 text-gray-300'
            : 'border-gray-200 text-gray-700 focus:border-green-500'"
      />
    </div>
    <button @click="$emit('remove', item.id)" class="text-gray-300 hover:text-red-500">
      &times;
    </button>
  </li>
</template>
