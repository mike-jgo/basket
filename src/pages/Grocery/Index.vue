<script setup>
import { ref, onMounted } from 'vue'
import { supabase } from '../../lib/supabase'
import PlanIndex from './Plan/Index.vue'
import ShopIndex from './Shop/Index.vue'

const currentListId = ref(null)
const loading = ref(true)
const shoppingMode = ref(false)
const showHistory = ref(false)
const pastLists = ref([])

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
    const { data: created, error } = await supabase
      .from('lists')
      .insert({ name: 'Grocery List' })
      .select('id')
      .single()

    if (error || !created) {
      console.error('Failed to create list:', error)
      loading.value = false
      return
    }

    currentListId.value = created.id
  }

  shoppingMode.value = localStorage.getItem(`shopping_mode_${currentListId.value}`) === 'true'
  loading.value = false
}

const loadHistory = async () => {
  const { data } = await supabase
    .from('lists')
    .select('id, name, completed_at, stores(name), items(*)')
    .not('completed_at', 'is', null)
    .order('completed_at', { ascending: false })
  pastLists.value = data || []
  showHistory.value = true
}

const onStartShopping = () => {
  shoppingMode.value = true
  localStorage.setItem(`shopping_mode_${currentListId.value}`, 'true')
}

const onBackToPlan = () => {
  shoppingMode.value = false
  localStorage.removeItem(`shopping_mode_${currentListId.value}`)
}

const onTripCompleted = async () => {
  localStorage.removeItem(`shopping_mode_${currentListId.value}`)
  await loadActiveList()
}

const backFromHistory = () => {
  if (shoppingMode.value) {
    showHistory.value = false
  } else {
    loadActiveList()
  }
}

const formatDate = (iso) =>
  new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })

const listTotal = (list) =>
  list.items.filter((i) => i.checked).reduce((sum, i) => sum + (i.price ?? 0), 0)
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
            @click="backFromHistory"
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
            <div class="flex items-baseline gap-2">
              <span class="font-medium text-gray-900">{{ formatDate(list.completed_at) }}</span>
              <span v-if="list.stores?.name" class="text-sm text-gray-400">· {{ list.stores.name }}</span>
            </div>
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

      <!-- Plan view -->
      <PlanIndex
        v-else-if="!shoppingMode"
        :list-id="currentListId"
        :key="`plan-${currentListId}`"
        @start-shopping="onStartShopping"
      />

      <!-- Shop view -->
      <ShopIndex
        v-else
        :list-id="currentListId"
        :key="`shop-${currentListId}`"
        @back-to-plan="onBackToPlan"
        @trip-completed="onTripCompleted"
      />

    </div>
  </div>
</template>
