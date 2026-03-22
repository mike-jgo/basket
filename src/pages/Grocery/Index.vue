<script setup>
import { ref, computed } from 'vue'
import GroceryRow from '../../components/GroceryRow.vue'

const items = ref([])
const nameInput = ref('')

const addItem = () => {
  const name = nameInput.value.trim()
  if (!name) return
  items.value.push({ id: Date.now(), name, checked: false })
  nameInput.value = ''
}

const toggleItem = (id) => {
  const item = items.value.find((i) => i.id === id)
  if (item) item.checked = !item.checked
}

const removeItem = (id) => {
  items.value = items.value.filter((i) => i.id !== id)
}

const uncheckedItems = computed(() => items.value.filter((i) => !i.checked))
const checkedItems = computed(() => items.value.filter((i) => i.checked))
</script>

<template>
  <div class="min-h-screen bg-gray-50">
    <div class="mx-auto max-w-lg px-4 py-12">
      <h1 class="mb-8 text-3xl font-bold text-gray-900">
        Basket
        <span class="ml-2 text-lg font-normal text-gray-400">grocery list</span>
      </h1>

      <form @submit.prevent="addItem" class="mb-8 flex gap-2">
        <input
          v-model="nameInput"
          type="text"
          placeholder="Add an item..."
          class="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-gray-900 placeholder-gray-400 focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
        />
        <button
          type="submit"
          class="rounded-lg bg-green-600 px-5 py-2 font-medium text-white hover:bg-green-700"
        >
          Add
        </button>
      </form>

      <p v-if="items.length === 0" class="text-center text-gray-400">
        Your grocery list is empty. Add some items above.
      </p>

      <div v-else class="space-y-6">
        <ul v-if="uncheckedItems.length" class="space-y-2">
          <GroceryRow
            v-for="item in uncheckedItems"
            :key="item.id"
            :item="item"
            @toggle="toggleItem"
            @remove="removeItem"
          />
        </ul>

        <div v-if="checkedItems.length">
          <h2 class="mb-2 text-sm font-medium uppercase tracking-wide text-gray-400">
            Checked off ({{ checkedItems.length }})
          </h2>
          <ul class="space-y-2">
            <GroceryRow
              v-for="item in checkedItems"
              :key="item.id"
              :item="item"
              @toggle="toggleItem"
              @remove="removeItem"
            />
          </ul>
        </div>
      </div>
    </div>
  </div>
</template>