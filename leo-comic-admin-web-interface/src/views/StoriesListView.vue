<script setup>
import { ref, onMounted } from 'vue'
import { listStories } from '../stories'

const stories = ref([])
const loading = ref(true)
const error = ref('')

function formatDate(ts) {
  if (!ts?.toDate) return ''
  return ts.toDate().toLocaleDateString()
}

onMounted(async () => {
  try {
    stories.value = await listStories()
  } catch (e) {
    error.value = 'No se pudieron cargar las historias.'
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div>
    <div class="header-row">
      <h1>Historias</h1>
      <RouterLink class="btn" :to="{ name: 'story-new' }">Nueva historia</RouterLink>
    </div>
    <p v-if="loading" class="muted">Cargando…</p>
    <p v-else-if="error" class="error">{{ error }}</p>
    <p v-else-if="!stories.length" class="muted">Todavía no hay historias.</p>
    <ul v-else class="story-list">
      <li v-for="story in stories" :key="story.id">
        <RouterLink class="card story-item" :to="{ name: 'story-detail', params: { id: story.id } }">
          <span class="title">{{ story.title }}</span>
          <span class="muted">{{ formatDate(story.createdAt) }}</span>
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

.story-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.story-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  text-decoration: none;
  color: var(--text);
}

.story-item .title {
  font-weight: 600;
}
</style>
