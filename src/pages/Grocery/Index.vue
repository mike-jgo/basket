<script setup>
import { ref, computed, onMounted } from 'vue'
import { supabase } from '../../lib/supabase'
import GroceryRow from '../../components/GroceryRow.vue'

const items = ref([])
const nameInput = ref('')
const priceInput = ref('')
const currentListId = ref(null)
const pastLists = ref([])
const showHistory = ref(false)
const loading = ref(true)

onMounted(async () => {
  await loadActiveList()
})

const loadActiveList = async () => {
  loading.value = true
  showHistory.value = false

  const { data: existing } = await supabase
    .from('lists')
    .select('id')
    .is('completed_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (existing) {
    currentListId.value = existing.id
  } else {
    const { data: created } = await supabase
      .from('lists')
      .insert({ name: 'Grocery List' })
      .select('id')
      .single()
    currentListId.value = created.id
  }

  await loadItems()
  loading.value = false
}

const loadItems = async () => {
  const { data } = await supabase
    .from('items')
    .select('*')
    .eq('list_id', currentListId.value)
    .order('created_at')
  items.value = data || []
}

const addItem = async () => {
  const name = nameInput.value.trim()
  if (!name) return

  const { data } = await supabase
    .from('items')
    .insert({
      list_id: currentListId.value,
      name,
      price: priceInput.value ? parseFloat(priceInput.value) : 0,
      checked: false,
    })
    .select()
    .single()

  items.value.push(data)
  nameInput.value = ''
  priceInput.value = ''
}

const toggleItem = async (id) => {
  const item = items.value.find((i) => i.id === id)
  if (!item) return
  item.checked = !item.checked
  await supabase.from('items').update({ checked: item.checked }).eq('id', id)
}

const removeItem = async (id) => {
  items.value = items.value.filter((i) => i.id !== id)
  await supabase.from('items').delete().eq('id', id)
}

const completeList = async () => {
  await supabase
    .from('lists')
    .update({ completed_at: new Date().toISOString() })
    .eq('id', currentListId.value)
  await loadActiveList()
}

const loadHistory = async () => {
  const { data } = await supabase
    .from('lists')
    .select('id, name, completed_at, items(*)')
    .not('completed_at', 'is', null)
    .order('completed_at', { ascending: false })
  pastLists.value = data || []
  showHistory.value = true
}

const uncheckedItems = computed(() => items.value.filter((i) => !i.checked))
const checkedItems = computed(() => items.value.filter((i) => i.checked))
const total = computed(() => items.value.reduce((sum, i) => sum + (i.price ?? 0), 0))
const checkedTotal = computed(() => checkedItems.value.reduce((sum, i) => sum + (i.price ?? 0), 0))
const hasAnyPrice = computed(() => items.value.some((i) => i.price > 0))

const formatDate = (iso) =>
  new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })

const listTotal = (list) =>
  list.items.reduce((sum, i) => sum + (i.price ?? 0), 0)
</script>

<template>
  <div class="min-h-screen bg-gray-50">
    <div class="mx-auto max-w-lg px-4 py-12">
      <div class="mb-8 flex items-center justify-between">
        <h1 class="text-3xl font-bold text-gray-900">
          Basket
          <span class="ml-2 text-lg font-normal text-gray-400">grocery list</span>
        </h1>
        <div class="flex gap-2">
          <button
            v-if="!showHistory"
            @click="loadHistory"
            class="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100"
          >
            History
          </button>
          <button
            v-else
            @click="loadActiveList"
            class="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100"
          >
            Current list
          </button>
        </div>
      </div>

      <!-- Loading -->
      <p v-if="loading" class="text-center text-gray-400">Loading...</p>

      <!-- History view -->
      <div v-else-if="showHistory" class="space-y-4">
        <p v-if="pastLists.length === 0" class="text-center text-gray-400">No past shopping trips yet.</p>
        <div
          v-for="list in pastLists"
          :key="list.id"
          class="rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-sm"
        >
          <div class="flex items-center justify-between">
            <span class="font-medium text-gray-900">{{ formatDate(list.completed_at) }}</span>
            <span v-if="listTotal(list) > 0" class="text-sm text-gray-500">₱{{ listTotal(list).toFixed(2) }}</span>
          </div>
          <ul class="mt-2 space-y-1">
            <li
              v-for="item in list.items"
              :key="item.id"
              class="flex justify-between text-sm"
              :class="item.checked ? 'text-gray-400 line-through' : 'text-gray-700'"
            >
              <span>{{ item.name }}</span>
              <span v-if="item.price">₱{{ item.price.toFixed(2) }}</span>
            </li>
          </ul>
        </div>
      </div>

      <!-- Active list -->
      <template v-else>
        <form @submit.prevent="addItem" class="mb-8 flex gap-2">
          <input
            v-model="nameInput"
            type="text"
            placeholder="Add an item..."
            class="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-gray-900 placeholder-gray-400 focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
          />
          <div class="relative">
            <span class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">₱</span>
            <input
              v-model="priceInput"
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              class="w-28 rounded-lg border border-gray-300 py-2 pl-7 pr-3 text-gray-900 placeholder-gray-400 focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
            />
          </div>
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

          <div v-if="hasAnyPrice" class="rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-sm">
            <div class="flex items-center justify-between text-sm text-gray-500">
              <span>Checked off</span>
              <span>₱{{ checkedTotal.toFixed(2) }}</span>
            </div>
            <div class="mt-1 flex items-center justify-between font-medium text-gray-900">
              <span>Total</span>
              <span>₱{{ total.toFixed(2) }}</span>
            </div>
          </div>

          <button
            @click="completeList"
            class="w-full rounded-lg border border-gray-300 py-2 text-sm text-gray-500 hover:bg-gray-100"
          >
            Complete shopping trip &rarr;
          </button>
        </div>
      </template>
    </div>
  </div>
</template>
