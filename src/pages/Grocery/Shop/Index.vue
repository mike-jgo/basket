<script setup>
import { ref, computed, onMounted } from 'vue'
import { supabase } from '../../../lib/supabase'
import GroceryRow from '../../../components/GroceryRow.vue'

const props = defineProps(['listId'])
const emit = defineEmits(['back-to-plan', 'trip-completed'])

const items = ref([])
const nameInput = ref('')
const brandInput = ref('')
const volumeAmountInput = ref('')
const volumeUnitInput = ref('g')
const quantityInput = ref(1)
const priceInput = ref('')
const showConfirm = ref(false)

const storeInput = ref('')
const knownStores = ref([])
const showStoreDropdown = ref(false)

const UNITS = ['g', 'kg', 'ml', 'L', 'lb', 'oz', 'pcs']

const volumeDisplay = (item) =>
  item.volume != null ? `${item.volume} ${item.volume_unit ?? ''}`.trim() : null

onMounted(async () => {
  await Promise.all([loadItems(), loadStore()])
})

const loadItems = async () => {
  const { data } = await supabase
    .from('items')
    .select('*')
    .eq('list_id', props.listId)
    .order('created_at')
  items.value = data || []
}

const loadStore = async () => {
  const { data: list } = await supabase
    .from('lists')
    .select('store_id, stores(name)')
    .eq('id', props.listId)
    .single()
  storeInput.value = list?.stores?.name ?? ''

  const { data: stores } = await supabase
    .from('stores').select('id, name').order('name')
  knownStores.value = stores ?? []
}

const saveStore = async () => {
  const name = storeInput.value.trim()
  if (!name) {
    await supabase.from('lists').update({ store_id: null }).eq('id', props.listId)
    return
  }
  const { data: store, error } = await supabase
    .from('stores')
    .upsert({ name }, { onConflict: 'name' })
    .select('id')
    .single()
  if (error || !store) { console.error('Failed to save store:', error); return }
  await supabase.from('lists').update({ store_id: store.id }).eq('id', props.listId)
}

const selectStore = async (store) => {
  storeInput.value = store.name
  showStoreDropdown.value = false
  await supabase.from('lists').update({ store_id: store.id }).eq('id', props.listId)
}

const storeFilteredOptions = computed(() => {
  const q = storeInput.value.trim().toLowerCase()
  if (!q) return knownStores.value
  return knownStores.value.filter((s) => s.name.toLowerCase().startsWith(q))
})

const addItem = async () => {
  const name = nameInput.value.trim()
  if (!name) return

  const price = parseFloat(priceInput.value)
  if (!price || price <= 0) return

  const { data, error } = await supabase
    .from('items')
    .insert({
      list_id: props.listId,
      name,
      brand: brandInput.value.trim() || null,
      volume: volumeAmountInput.value ? parseFloat(volumeAmountInput.value) : null,
      volume_unit: volumeAmountInput.value ? volumeUnitInput.value : null,
      quantity: parseInt(quantityInput.value) || 1,
      price,
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
  volumeAmountInput.value = ''
  volumeUnitInput.value = 'g'
  quantityInput.value = 1
  priceInput.value = ''
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

const confirmComplete = async () => {
  const { error } = await supabase
    .from('lists')
    .update({ completed_at: new Date().toISOString() })
    .eq('id', props.listId)

  if (error) {
    console.error('Failed to complete trip:', error)
    return
  }

  showConfirm.value = false
  emit('trip-completed')
}

const uncheckedItems = computed(() => items.value.filter((i) => !i.checked))
const checkedItems = computed(() => items.value.filter((i) => i.checked))
const total = computed(() => Math.round(items.value.reduce((sum, i) => sum + (i.price ?? 0) * (i.quantity ?? 1), 0) * 100) / 100)
const checkedTotal = computed(() => Math.round(checkedItems.value.reduce((sum, i) => sum + (i.price ?? 0) * (i.quantity ?? 1), 0) * 100) / 100)
const hasAnyPrice = computed(() => items.value.some((i) => i.price > 0))
</script>

<template>
  <!-- Store input -->
  <div class="relative mb-6">
    <label class="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-400">
      Shopping at
    </label>
    <input
      v-model="storeInput"
      type="text"
      placeholder="Store name (e.g. SM, Puregold...)"
      autocomplete="off"
      @focus="showStoreDropdown = true"
      @blur="showStoreDropdown = false; saveStore()"
      class="w-full rounded-lg border border-gray-300 px-4 py-2 text-gray-900 placeholder-gray-400 focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
    />
    <ul
      v-if="showStoreDropdown && storeFilteredOptions.length"
      class="absolute z-10 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg"
    >
      <li
        v-for="store in storeFilteredOptions"
        :key="store.id"
        @mousedown.prevent="selectStore(store)"
        class="cursor-pointer px-4 py-2 text-gray-700 hover:bg-green-50 hover:text-green-700"
      >
        {{ store.name }}
      </li>
    </ul>
  </div>

  <!-- Add item form -->
  <form @submit.prevent="addItem" class="mb-6 space-y-2">
    <input
      v-model="nameInput"
      type="text"
      placeholder="Forgot something?"
      class="w-full rounded-lg border border-gray-300 px-4 py-2 text-gray-900 placeholder-gray-400 focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
    />
    <div class="flex flex-wrap gap-2">
      <input
        v-model="brandInput"
        type="text"
        placeholder="Brand"
        class="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-400 focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500 sm:flex-1 sm:w-auto"
      />
      <div class="flex shrink-0 overflow-hidden rounded-lg border border-gray-300 focus-within:border-green-500 focus-within:ring-1 focus-within:ring-green-500">
        <input
          v-model="volumeAmountInput"
          type="number"
          min="0"
          step="any"
          placeholder="vol"
          class="w-20 border-none py-2 pl-3 pr-1 text-gray-900 placeholder-gray-400 focus:outline-none"
        />
        <select
          v-model="volumeUnitInput"
          class="border-l border-gray-300 bg-gray-50 py-2 pl-2 pr-1 text-sm text-gray-700 focus:outline-none"
        >
          <option v-for="u in UNITS" :key="u" :value="u">{{ u }}</option>
        </select>
      </div>
      <div class="flex shrink-0 overflow-hidden rounded-lg border border-gray-300 focus-within:border-green-500 focus-within:ring-1 focus-within:ring-green-500">
        <span class="flex items-center pl-3 text-xs text-gray-400 select-none">qty</span>
        <input
          v-model="quantityInput"
          type="number"
          min="1"
          step="1"
          class="w-14 border-none py-2 pl-2 pr-3 text-gray-900 focus:outline-none"
        />
      </div>
      <div class="relative shrink-0">
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
        class="w-full rounded-lg bg-green-600 px-5 py-2 font-medium text-white hover:bg-green-700 sm:w-auto"
      >
        Add
      </button>
    </div>
  </form>

  <!-- Empty state -->
  <div v-if="items.length === 0" class="space-y-4 text-center">
    <p class="text-gray-400">Your grocery list is empty.</p>
    <button
      @click="emit('back-to-plan')"
      class="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-100"
    >
      &larr; Back to plan
    </button>
  </div>

  <div v-else class="space-y-6">
    <!-- Unchecked items -->
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

    <!-- Checked items -->
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

    <!-- Totals -->
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

  <!-- Completion confirmation modal -->
  <div
    v-if="showConfirm"
    class="fixed inset-0 z-10 flex items-end justify-center bg-black/30 px-4 pb-8 sm:items-center"
  >
    <div class="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
      <h2 class="mb-1 text-lg font-semibold text-gray-900">Complete this trip?</h2>
      <div class="mb-4 rounded-lg bg-gray-50 px-4 py-3">
        <ul class="space-y-1.5">
          <li
            v-for="item in checkedItems"
            :key="item.id"
            class="flex items-start justify-between gap-2 text-sm"
          >
            <div class="min-w-0">
              <span class="text-gray-700">{{ item.name }}</span>
              <span v-if="item.brand || item.volume != null || item.quantity > 1" class="block text-xs text-gray-400">
                {{ [item.brand, volumeDisplay(item), item.quantity > 1 ? `×${item.quantity}` : null].filter(Boolean).join(' · ') }}
              </span>
            </div>
            <span v-if="item.price" class="shrink-0 text-gray-500">
              ₱{{ (item.price * (item.quantity ?? 1)).toFixed(2) }}
            </span>
          </li>
          <li
            v-for="item in uncheckedItems"
            :key="item.id"
            class="flex items-start justify-between gap-2 text-sm text-gray-400"
          >
            <div class="min-w-0">
              <span>{{ item.name }}</span>
              <span v-if="item.brand || item.volume != null || item.quantity > 1" class="block text-xs text-gray-300">
                {{ [item.brand, volumeDisplay(item), item.quantity > 1 ? `×${item.quantity}` : null].filter(Boolean).join(' · ') }}
              </span>
            </div>
            <span v-if="item.price" class="shrink-0">
              ₱{{ (item.price * (item.quantity ?? 1)).toFixed(2) }}
            </span>
          </li>
        </ul>
        <div v-if="checkedTotal > 0" class="mt-3 flex justify-between border-t border-gray-200 pt-3 font-medium">
          <span class="text-gray-900">Total spent</span>
          <span class="text-gray-900">₱{{ checkedTotal.toFixed(2) }}</span>
        </div>
      </div>

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
