<script setup>
import { ref, onMounted } from 'vue'
import { listCharacters } from '../characters'

const characters = ref([])
const loading = ref(true)
const error = ref('')

onMounted(async () => {
  try {
    characters.value = await listCharacters()
  } catch (e) {
    error.value = 'No se pudieron cargar los personajes.'
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div>
    <div class="header-row">
      <h1>Personajes</h1>
      <RouterLink class="btn" :to="{ name: 'character-new' }">Nuevo personaje</RouterLink>
    </div>
    <p v-if="loading" class="muted">Cargando…</p>
    <p v-else-if="error" class="error">{{ error }}</p>
    <p v-else-if="!characters.length" class="muted">Todavía no hay personajes.</p>
    <ul v-else class="character-list">
      <li v-for="character in characters" :key="character.id">
        <RouterLink
          class="card character-item"
          :to="{ name: 'character-detail', params: { id: character.id } }"
        >
          <span class="title">{{ character.name }}</span>
        </RouterLink>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.header-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.character-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.character-item {
  display: block;
  text-decoration: none;
  color: var(--text);
}

.character-item .title {
  font-weight: 600;
}
</style>
