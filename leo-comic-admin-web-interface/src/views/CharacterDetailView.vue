<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import {
  getCharacter,
  createCharacter,
  updateCharacter,
  deleteCharacter,
  uploadCharacterAngleImage,
} from '../characters'

const props = defineProps({
  id: { type: String, default: null },
})

const router = useRouter()
const isNew = computed(() => !props.id)

const name = ref('')
const description = ref('')
const angleImages = ref({})
const newAngleName = ref('')

const loading = ref(!isNew.value)
const saving = ref(false)
const uploadingAngle = ref('')
const error = ref('')

onMounted(async () => {
  if (isNew.value) return
  try {
    const character = await getCharacter(props.id)
    if (!character) {
      error.value = 'Personaje no encontrado.'
      return
    }
    name.value = character.name || ''
    description.value = character.description || ''
    angleImages.value = character.angleImages || {}
  } catch (e) {
    error.value = 'No se pudo cargar el personaje.'
  } finally {
    loading.value = false
  }
})

async function onSubmit() {
  error.value = ''
  saving.value = true
  try {
    if (isNew.value) {
      const id = await createCharacter({ name: name.value, description: description.value })
      router.push({ name: 'character-detail', params: { id } })
    } else {
      await updateCharacter(props.id, { name: name.value, description: description.value })
    }
  } catch (e) {
    error.value = 'No se pudo guardar el personaje.'
  } finally {
    saving.value = false
  }
}

async function onDelete() {
  if (!confirm('¿Borrar este personaje?')) return
  await deleteCharacter(props.id)
  router.push({ name: 'characters' })
}

async function onAngleFileChange(event, angle) {
  const file = event.target.files?.[0]
  if (!file || !props.id || !angle) return
  uploadingAngle.value = angle
  error.value = ''
  try {
    const url = await uploadCharacterAngleImage(props.id, angle, file)
    angleImages.value = { ...angleImages.value, [angle]: url }
  } catch (e) {
    error.value = 'No se pudo subir la imagen.'
  } finally {
    uploadingAngle.value = ''
  }
}

function addAngle() {
  const angle = newAngleName.value.trim()
  if (!angle) return
  angleImages.value = { ...angleImages.value, [angle]: angleImages.value[angle] || '' }
  newAngleName.value = ''
}
</script>

<template>
  <div>
    <RouterLink to="/characters" class="muted">&larr; Personajes</RouterLink>
    <h1>{{ isNew ? 'Nuevo personaje' : 'Editar personaje' }}</h1>
    <p v-if="loading" class="muted">Cargando…</p>
    <form v-else class="card" @submit.prevent="onSubmit">
      <div class="field">
        <label for="name">Nombre</label>
        <input id="name" v-model="name" type="text" required />
      </div>
      <div class="field">
        <label for="description">Descripción</label>
        <textarea id="description" v-model="description" rows="6" required></textarea>
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

    <section v-if="!isNew" class="angles-section">
      <h2>Imágenes por ángulo</h2>
      <div class="angle-add">
        <input
          v-model="newAngleName"
          type="text"
          placeholder="Nombre del ángulo (p.ej. frontal, perfil)"
        />
        <button type="button" class="btn secondary" @click="addAngle">Añadir ángulo</button>
      </div>
      <div class="angle-grid">
        <div v-for="(url, angle) in angleImages" :key="angle" class="card angle-item">
          <h3>{{ angle }}</h3>
          <img v-if="url" :src="url" :alt="angle" class="angle-image" />
          <p v-else class="muted">Sin imagen todavía.</p>
          <input
            type="file"
            accept="image/*"
            :disabled="uploadingAngle === angle"
            @change="(e) => onAngleFileChange(e, angle)"
          />
          <p v-if="uploadingAngle === angle" class="muted">Subiendo…</p>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.actions {
  display: flex;
  gap: 0.75rem;
}

.angles-section {
  margin-top: 2rem;
}

.angle-add {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.angle-add input {
  flex: 1;
  padding: 0.5rem;
  border: 1px solid var(--border);
  border-radius: 6px;
}

.angle-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 1rem;
}

.angle-item h3 {
  margin-top: 0;
  text-transform: capitalize;
}

.angle-image {
  max-width: 100%;
  border-radius: 6px;
  margin-bottom: 0.5rem;
}
</style>
