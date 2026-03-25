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
const shoppingMode = ref(false)
const suggestions = ref([])

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

  shoppingMode.value = localStorage.getItem(`shopping_mode_${currentListId.value}`) === 'true'

  await Promise.all([loadItems(), loadSuggestions()])
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

const loadSuggestions = async () => {
  const { data: completedLists } = await supabase
    .from('lists')
    .select('id')
    .not('completed_at', 'is', null)

  if (!completedLists?.length) return

  const listIds = completedLists.map((l) => l.id)
  const { data } = await supabase
    .from('items')
    .select('name, price, created_at')
    .in('list_id', listIds)
    .order('created_at', { ascending: false })

  if (!data) return

  const seen = new Set()
  suggestions.value = data
    .filter((item) => {
      const key = item.name.toLowerCase()
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    .map((item) => ({ name: item.name, price: item.price ?? 0 }))
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

const addFromSuggestion = async (suggestion) => {
  const { data } = await supabase
    .from('items')
    .insert({
      list_id: currentListId.value,
      name: suggestion.name,
      price: suggestion.price,
      checked: false,
    })
    .select()
    .single()

  items.value.push(data)
}

const updatePrice = async (id, price) => {
  const item = items.value.find((i) => i.id === id)
  if (!item) return
  item.price = price
  await supabase.from('items').update({ price }).eq('id', id)
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

const startShopping = () => {
  shoppingMode.value = true
  localStorage.setItem(`shopping_mode_${currentListId.value}`, 'true')
}

const backToPlan = () => {
  shoppingMode.value = false
  localStorage.removeItem(`shopping_mode_${currentListId.value}`)
}

const showConfirm = ref(false)

const confirmComplete = async () => {
  await supabase
    .from('lists')
    .update({ completed_at: new Date().toISOString() })
    .eq('id', currentListId.value)
  localStorage.removeItem(`shopping_mode_${currentListId.value}`)
  showConfirm.value = false
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

const filteredSuggestions = computed(() => {
  const planned = new Set(items.value.map((i) => i.name.toLowerCase()))
  return suggestions.value.filter((s) => !planned.has(s.name.toLowerCase()))
})

const uncheckedItems = computed(() => items.value.filter((i) => !i.checked))
const checkedItems = computed(() => items.value.filter((i) => i.checked))
const total = computed(() => Math.round(items.value.reduce((sum, i) => sum + (i.price ?? 0), 0) * 100) / 100)
const checkedTotal = computed(() => Math.round(checkedItems.value.reduce((sum, i) => sum + (i.price ?? 0), 0) * 100) / 100)
const hasAnyPrice = computed(() => items.value.some((i) => i.price > 0))

const formatDate = (iso) =>
  new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })

const listTotal = (list) => list.items.filter((i) => i.checked).reduce((sum, i) => sum + (i.price ?? 0), 0)
</script>

<template>
  <div class="min-h-screen bg-gray-50">
    <div class="mx-auto max-w-lg px-4 py-12">

      <!-- Header -->
      <div class="mb-8 flex items-center justify-between">
        <h1 class="text-3xl font-bold text-gray-900">
          Basket
          <span class="ml-2 text-lg font-normal text-gray-400">
            {{ showHistory ? 'history' : shoppingMode ? 'grocery list' : 'plan your trip' }}
          </span>
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
            @click="shoppingMode ? (showHistory = false) : loadActiveList()"
            class="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100"
          >
            {{ shoppingMode ? 'Current list' : 'Back to plan' }}
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

      <!-- Planning view -->
      <template v-else-if="!shoppingMode">
        <!-- Add item form -->
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

        <!-- Planned items -->
        <div v-if="items.length" class="mb-8 space-y-4">
          <h2 class="text-sm font-medium uppercase tracking-wide text-gray-400">
            Your plan ({{ items.length }})
          </h2>
          <ul class="space-y-2">
            <li
              v-for="item in items"
              :key="item.id"
              class="flex items-center gap-3 rounded-lg bg-white px-4 py-3 shadow-sm"
            >
              <span class="flex-1 text-gray-900">{{ item.name }}</span>
              <div class="relative">
                <span class="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-xs text-gray-400">₱</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  :value="item.price ? item.price.toFixed(2) : ''"
                  placeholder="0.00"
                  @change="updatePrice(item.id, parseFloat($event.target.value) || 0)"
                  class="w-24 rounded border border-gray-200 py-1 pl-5 pr-2 text-sm text-gray-700 focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
                />
              </div>
              <button @click="removeItem(item.id)" class="text-gray-300 hover:text-red-500">&times;</button>
            </li>
          </ul>

          <button
            @click="startShopping"
            class="w-full rounded-lg bg-green-600 py-2 font-medium text-white hover:bg-green-700"
          >
            Start shopping &rarr;
          </button>
        </div>

        <!-- Suggestions from past trips -->
        <div v-if="filteredSuggestions.length">
          <h2 class="mb-3 text-sm font-medium uppercase tracking-wide text-gray-400">
            {{ items.length ? 'Add from previous trips' : 'Previous items' }}
          </h2>
          <ul class="space-y-2">
            <li
              v-for="s in filteredSuggestions"
              :key="s.name"
            >
              <button
                @click="addFromSuggestion(s)"
                class="flex w-full items-center justify-between rounded-lg border border-dashed border-gray-300 bg-white px-4 py-2.5 text-left hover:border-green-400 hover:bg-green-50"
              >
                <span class="text-gray-700">{{ s.name }}</span>
                <span class="text-sm text-gray-400">{{ s.price ? '₱' + s.price.toFixed(2) : '+ add' }}</span>
              </button>
            </li>
          </ul>
        </div>

        <p v-else-if="!items.length" class="text-center text-gray-400">
          Add items above to start planning your trip.
        </p>
      </template>

      <!-- Shopping view -->
      <template v-else>
        <form @submit.prevent="addItem" class="mb-6 flex gap-2">
          <input
            v-model="nameInput"
            type="text"
            placeholder="Forgot something?"
            class="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-gray-900 placeholder-gray-400 focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
          />
          <div class="relative">
            <span class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">₱</span>
            <input
              v-model="priceInput"
              type="number"
              min="0.01"
              step="0.01"
              placeholder="0.00"
              required
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

        <div v-if="items.length === 0" class="space-y-4 text-center">
          <p class="text-gray-400">Your grocery list is empty.</p>
          <button
            @click="backToPlan"
            class="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-100"
          >
            &larr; Back to plan
          </button>
        </div>

        <div v-else class="space-y-6">
          <ul v-if="uncheckedItems.length" class="space-y-2">
            <GroceryRow
              v-for="item in uncheckedItems"
              :key="item.id"
              :item="item"
              :requirePrice="true"
              @toggle="toggleItem"
              @remove="removeItem"
              @updatePrice="updatePrice"
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
                @updatePrice="updatePrice"
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
            @click="showConfirm = true"
            class="w-full rounded-lg border border-gray-300 py-2 text-sm text-gray-500 hover:bg-gray-100"
          >
            Complete shopping trip &rarr;
          </button>
        </div>

        <!-- Completion confirmation -->
        <div
          v-if="showConfirm"
          class="fixed inset-0 z-10 flex items-end justify-center bg-black/30 px-4 pb-8 sm:items-center"
        >
          <div class="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
            <h2 class="mb-1 text-lg font-semibold text-gray-900">Complete this trip?</h2>
            <div v-if="items.length" class="mb-4 rounded-lg bg-gray-50 px-4 py-3">
              <ul class="space-y-1.5">
                <li
                  v-for="item in checkedItems"
                  :key="item.id"
                  class="flex justify-between text-sm"
                >
                  <span class="text-gray-700">{{ item.name }}</span>
                  <span v-if="item.price" class="text-gray-500">₱{{ item.price.toFixed(2) }}</span>
                </li>
                <li
                  v-for="item in uncheckedItems"
                  :key="item.id"
                  class="flex justify-between text-sm text-gray-400"
                >
                  <span>{{ item.name }}</span>
                  <span v-if="item.price">₱{{ item.price.toFixed(2) }}</span>
                </li>
              </ul>
              <div v-if="checkedTotal > 0" class="mt-3 flex justify-between border-t border-gray-200 pt-3 font-medium">
                <span class="text-gray-900">Total spent</span>
                <span class="text-gray-900">₱{{ checkedTotal.toFixed(2) }}</span>
              </div>
            </div>

            <p v-else class="mb-4 text-sm text-gray-500">Nothing on this list.</p>

            <div class="flex gap-3">
              <button
                @click="showConfirm = false"
                class="flex-1 rounded-lg border border-gray-300 py-2 text-sm text-gray-600 hover:bg-gray-100"
              >
                Keep shopping
              </button>
              <button
                @click="confirmComplete"
                class="flex-1 rounded-lg bg-green-600 py-2 text-sm font-medium text-white hover:bg-green-700"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      </template>

    </div>
  </div>
</template>
