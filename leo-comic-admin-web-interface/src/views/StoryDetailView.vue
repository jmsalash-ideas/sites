<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import {
  getStory,
  createStory,
  updateStory,
  deleteStory,
  uploadStoryImage,
} from '../stories'

const props = defineProps({
  id: { type: String, default: null },
})

const router = useRouter()
const isNew = computed(() => !props.id)

const title = ref('')
const description = ref('')
const imagePrompt = ref('')
const comicImageUrl = ref('')

const loading = ref(!isNew.value)
const saving = ref(false)
const uploading = ref(false)
const error = ref('')
const copied = ref(false)

onMounted(async () => {
  if (isNew.value) return
  try {
    const story = await getStory(props.id)
    if (!story) {
      error.value = 'Historia no encontrada.'
      return
    }
    title.value = story.title || ''
    description.value = story.description || ''
    imagePrompt.value = story.imagePrompt || ''
    comicImageUrl.value = story.comicImageUrl || ''
  } catch (e) {
    error.value = 'No se pudo cargar la historia.'
  } finally {
    loading.value = false
  }
})

async function onSubmit() {
  error.value = ''
  saving.value = true
  try {
    if (isNew.value) {
      const id = await createStory({
        title: title.value,
        description: description.value,
        imagePrompt: imagePrompt.value,
      })
      router.push({ name: 'story-detail', params: { id } })
    } else {
      await updateStory(props.id, {
        title: title.value,
        description: description.value,
        imagePrompt: imagePrompt.value,
      })
    }
  } catch (e) {
    error.value = 'No se pudo guardar la historia.'
  } finally {
    saving.value = false
  }
}

async function onDelete() {
  if (!confirm('¿Borrar esta historia?')) return
  await deleteStory(props.id)
  router.push({ name: 'stories' })
}

async function onFileChange(event) {
  const file = event.target.files?.[0]
  if (!file || !props.id) return
  uploading.value = true
  error.value = ''
  try {
    comicImageUrl.value = await uploadStoryImage(props.id, file)
  } catch (e) {
    error.value = 'No se pudo subir la imagen.'
  } finally {
    uploading.value = false
  }
}

async function copyPrompt() {
  await navigator.clipboard.writeText(imagePrompt.value)
  copied.value = true
  setTimeout(() => (copied.value = false), 1500)
}
</script>

<template>
  <div>
    <RouterLink to="/" class="muted">&larr; Historias</RouterLink>
    <h1>{{ isNew ? 'Nueva historia' : 'Editar historia' }}</h1>
    <p v-if="loading" class="muted">Cargando…</p>
    <form v-else class="card" @submit.prevent="onSubmit">
      <div class="field">
        <label for="title">Título</label>
        <input id="title" v-model="title" type="text" required />
      </div>
      <div class="field">
        <label for="description">Descripción</label>
        <textarea id="description" v-model="description" rows="6" required></textarea>
      </div>
      <div class="field">
        <label for="prompt">Prompt de imagen</label>
        <textarea id="prompt" v-model="imagePrompt" rows="4"></textarea>
        <button
          v-if="imagePrompt"
          type="button"
          class="btn secondary copy-btn"
          @click="copyPrompt"
        >
          {{ copied ? 'Copiado' : 'Copiar prompt' }}
        </button>
      </div>

      <div v-if="!isNew" class="field">
        <label>Imagen del cómic</label>
        <img v-if="comicImageUrl" :src="comicImageUrl" class="comic-image" alt="Imagen de la historia" />
        <p v-else class="muted">Sin imagen todavía.</p>
        <input type="file" accept="image/*" :disabled="uploading" @change="onFileChange" />
        <p v-if="uploading" class="muted">Subiendo…</p>
      </div>

      <p v-if="error" class="error">{{ error }}</p>

      <div class="actions">
        <button class="btn" type="submit" :disabled="saving">
          {{ saving ? 'Guardando…' : 'Guardar' }}
        </button>
        <button v-if="!isNew" type="button" class="btn danger" @click="onDelete">
          Borrar
        </button>
      </div>
    </form>
  </div>
</template>

<style scoped>
.comic-image {
  max-width: 100%;
  border-radius: 6px;
  margin-bottom: 0.5rem;
}

.copy-btn {
  align-self: flex-start;
  margin-top: 0.25rem;
}

.actions {
  display: flex;
  gap: 0.75rem;
}
</style>
