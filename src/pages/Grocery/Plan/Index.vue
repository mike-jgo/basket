<script setup>
import { ref, computed, onMounted } from 'vue'
import { supabase } from '../../../lib/supabase'

const props = defineProps(['listId'])
const emit = defineEmits(['start-shopping'])

const items = ref([])
const nameInput = ref('')
const brandInput = ref('')
const volumeInput = ref('')
const priceInput = ref('')
const suggestions = ref([])
const selectedStore = ref(null)
const allStores = ref([])

onMounted(async () => {
  await Promise.all([loadItems(), loadSuggestions()])
})

const loadItems = async () => {
  const { data } = await supabase
    .from('items')
    .select('*')
    .eq('list_id', props.listId)
    .order('created_at')
  items.value = data || []
}

const loadSuggestions = async () => {
  const { data: completedLists } = await supabase
    .from('lists')
    .select('id, stores(name)')
    .not('completed_at', 'is', null)

  if (!completedLists?.length) return

  const storeByListId = new Map(
    completedLists.map((l) => [l.id, l.stores?.name ?? null])
  )
  const listIds = completedLists.map((l) => l.id)

  const { data } = await supabase
    .from('items')
    .select('list_id, name, brand, volume, price, created_at')
    .in('list_id', listIds)
    .order('created_at', { ascending: false })
    .limit(500)

  if (!data) return

  // Group by brand|name|volume. Newest-first means first row per item+store = most recent price.
  const grouped = new Map()
  for (const row of data) {
    const key = `${(row.brand ?? '').toLowerCase()}|${row.name.toLowerCase()}|${(row.volume ?? '').toLowerCase()}`
    const store = storeByListId.get(row.list_id)
    if (!grouped.has(key)) {
      grouped.set(key, {
        name: row.name,
        brand: row.brand ?? '',
        volume: row.volume ?? '',
        storePrices: new Map(),
      })
    }
    const entry = grouped.get(key)
    if (!entry.storePrices.has(store)) entry.storePrices.set(store, row.price ?? 0)
  }

  suggestions.value = Array.from(grouped.values()).map((entry) => ({
    name: entry.name,
    brand: entry.brand,
    volume: entry.volume,
    storePrices: Array.from(entry.storePrices.entries()).map(([store, price]) => ({ store, price })),
  }))

  const storeSet = new Set()
  for (const s of suggestions.value)
    for (const sp of s.storePrices)
      if (sp.store !== null) storeSet.add(sp.store)
  allStores.value = [...storeSet].sort()
}

const addItem = async () => {
  const name = nameInput.value.trim()
  if (!name) return

  const { data, error } = await supabase
    .from('items')
    .insert({
      list_id: props.listId,
      name,
      brand: brandInput.value.trim() || null,
      volume: volumeInput.value.trim() || null,
      price: priceInput.value ? parseFloat(priceInput.value) : 0,
      checked: false,
    })
    .select()
    .single()

  if (error || !data) {
    console.error('Failed to add item:', error)
    return
  }

  items.value.push(data)
  nameInput.value = ''
  brandInput.value = ''
  volumeInput.value = ''
  priceInput.value = ''
}

const addFromSuggestion = async (suggestion) => {
  const preferred = selectedStore.value
    ? suggestion.storePrices.find((sp) => sp.store === selectedStore.value)
    : null
  const price = (preferred ?? suggestion.storePrices[0])?.price ?? 0

  const { data, error } = await supabase
    .from('items')
    .insert({
      list_id: props.listId,
      name: suggestion.name,
      brand: suggestion.brand || null,
      volume: suggestion.volume || null,
      price,
      checked: false,
    })
    .select()
    .single()

  if (error || !data) {
    console.error('Failed to add suggestion:', error)
    return
  }

  items.value.push(data)
}

const updatePrice = async (id, price) => {
  const item = items.value.find((i) => i.id === id)
  if (!item) return
  item.price = price
  await supabase.from('items').update({ price }).eq('id', id)
}

const removeItem = async (id) => {
  items.value = items.value.filter((i) => i.id !== id)
  await supabase.from('items').delete().eq('id', id)
}

const filteredSuggestions = computed(() => {
  const planned = new Set(
    items.value.map((i) =>
      `${(i.brand ?? '').toLowerCase()}|${i.name.toLowerCase()}|${(i.volume ?? '').toLowerCase()}`
    )
  )
  return suggestions.value.filter((s) => {
    const key = `${s.brand.toLowerCase()}|${s.name.toLowerCase()}|${s.volume.toLowerCase()}`
    if (planned.has(key)) return false
    if (selectedStore.value !== null)
      return s.storePrices.some((sp) => sp.store === selectedStore.value)
    return true
  })
})
</script>

<template>
  <!-- Add item form -->
  <form @submit.prevent="addItem" class="mb-8 space-y-2">
    <input
      v-model="nameInput"
      type="text"
      placeholder="Item name"
      class="w-full rounded-lg border border-gray-300 px-4 py-2 text-gray-900 placeholder-gray-400 focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
    />
    <div class="flex flex-wrap gap-2">
      <input
        v-model="brandInput"
        type="text"
        placeholder="Brand"
        class="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-400 focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500 sm:flex-1 sm:w-auto"
      />
      <input
        v-model="volumeInput"
        type="text"
        placeholder="Vol / Weight"
        class="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-400 focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500 sm:flex-none sm:w-28"
      />
      <div class="relative flex-1 sm:flex-none">
        <span class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">₱</span>
        <input
          v-model="priceInput"
          type="number"
          min="0"
          step="0.01"
          placeholder="0.00"
          class="w-full rounded-lg border border-gray-300 py-2 pl-7 pr-3 text-gray-900 placeholder-gray-400 focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500 sm:w-28"
        />
      </div>
      <button
        type="submit"
        class="w-full rounded-lg bg-green-600 px-5 py-2 font-medium text-white hover:bg-green-700 sm:w-auto"
      >
        Add
      </button>
    </div>
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
        <div class="flex-1 min-w-0">
          <span class="block text-gray-900">{{ item.name }}</span>
          <span
            v-if="item.brand || item.volume"
            class="block truncate text-xs text-gray-400"
          >
            {{ [item.brand, item.volume].filter(Boolean).join(' · ') }}
          </span>
        </div>
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
      @click="emit('start-shopping')"
      class="w-full rounded-lg bg-green-600 py-2 font-medium text-white hover:bg-green-700"
    >
      Start shopping &rarr;
    </button>
  </div>

  <!-- Suggestions from past trips -->
  <div v-if="filteredSuggestions.length">
    <!-- Store filter chips -->
    <div v-if="allStores.length" class="mb-4 flex flex-wrap gap-2">
      <button
        @click="selectedStore = null"
        class="rounded-full border px-3 py-1 text-sm font-medium transition-colors"
        :class="selectedStore === null
          ? 'border-green-600 bg-green-600 text-white'
          : 'border-gray-300 text-gray-600 hover:bg-gray-100'"
      >
        All
      </button>
      <button
        v-for="store in allStores"
        :key="store"
        @click="selectedStore = store"
        class="rounded-full border px-3 py-1 text-sm font-medium transition-colors"
        :class="selectedStore === store
          ? 'border-green-600 bg-green-600 text-white'
          : 'border-gray-300 text-gray-600 hover:bg-gray-100'"
      >
        {{ store }}
      </button>
    </div>

    <h2 class="mb-3 text-sm font-medium uppercase tracking-wide text-gray-400">
      {{ items.length ? 'Add from previous trips' : 'Previous items' }}
    </h2>
    <ul class="space-y-2">
      <li v-for="s in filteredSuggestions" :key="`${s.brand}|${s.name}|${s.volume}`">
        <button
          @click="addFromSuggestion(s)"
          class="flex w-full items-center justify-between rounded-lg border border-dashed border-gray-300 bg-white px-4 py-2.5 text-left hover:border-green-400 hover:bg-green-50"
        >
          <div class="min-w-0">
            <span class="block text-gray-700">{{ s.name }}</span>
            <span v-if="s.brand || s.volume" class="block text-xs text-gray-400">
              {{ [s.brand, s.volume].filter(Boolean).join(' · ') }}
            </span>
          </div>
          <div class="ml-4 shrink-0 text-right">
            <template v-if="s.storePrices.some((sp) => sp.store !== null)">
              <span
                v-for="sp in s.storePrices.filter((sp) => sp.store !== null)"
                :key="sp.store"
                class="block text-xs"
                :class="selectedStore === sp.store ? 'font-semibold text-green-700' : 'text-gray-400'"
              >
                {{ sp.store }} ₱{{ sp.price.toFixed(2) }}
              </span>
            </template>
            <template v-else>
              <span class="text-sm text-gray-400">
                {{ s.storePrices[0]?.price ? '₱' + s.storePrices[0].price.toFixed(2) : '+ add' }}
              </span>
            </template>
          </div>
        </button>
      </li>
    </ul>
  </div>

  <p v-else-if="!items.length" class="text-center text-gray-400">
    Add items above to start planning your trip.
  </p>
</template>
