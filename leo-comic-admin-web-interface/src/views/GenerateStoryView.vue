<script setup>
import { ref, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { startLiveSession, draftStoryFromTranscript } from '../gemini'
import { startMicCapture, createAudioPlayer } from '../audio'
import { createStory } from '../stories'

const router = useRouter()

const status = ref('idle') // idle | connecting | listening | drafting | review | error
const error = ref('')
const turns = ref([]) // { speaker: 'tu' | 'leo', text: string }

const draftTitle = ref('')
const draftDescription = ref('')
const draftImagePrompt = ref('')
const saving = ref(false)

let session = null
let micCapture = null
let player = null

function pushTurn(speaker, text) {
  if (!text) return
  const last = turns.value[turns.value.length - 1]
  if (last && last.speaker === speaker) {
    last.text += text
  } else {
    turns.value.push({ speaker, text })
  }
}

function fullTranscript() {
  return turns.value.map((t) => `${t.speaker === 'tu' ? 'Padre' : 'Asistente'}: ${t.text}`).join('\n')
}

async function startConversation() {
  error.value = ''
  status.value = 'connecting'
  turns.value = []
  player = createAudioPlayer()

  try {
    session = await startLiveSession({
      onopen: () => {
        status.value = 'listening'
      },
      onmessage: (message) => {
        const inputText = message.serverContent?.inputTranscription?.text
        const outputText = message.serverContent?.outputTranscription?.text
        if (inputText) pushTurn('tu', inputText)
        if (outputText) pushTurn('leo', outputText)

        const parts = message.serverContent?.modelTurn?.parts || []
        for (const part of parts) {
          if (part.inlineData?.data) {
            player.enqueue(part.inlineData.data)
          }
        }
      },
      onerror: (e) => {
        error.value = `Error de conexión con Gemini: ${e.message || e}`
        status.value = 'error'
      },
      onclose: () => {
        if (status.value === 'listening') status.value = 'idle'
      },
    })

    micCapture = await startMicCapture((base64Chunk) => {
      session?.sendRealtimeInput({
        audio: { data: base64Chunk, mimeType: 'audio/pcm;rate=16000' },
      })
    })
  } catch (e) {
    error.value = 'No se pudo iniciar la conversación. Revisa el micrófono y las credenciales.'
    status.value = 'error'
  }
}

function stopCapture() {
  micCapture?.stop()
  micCapture = null
  session?.close()
  session = null
  player?.close()
  player = null
}

async function finishConversation() {
  stopCapture()
  if (!turns.value.length) {
    status.value = 'idle'
    return
  }
  status.value = 'drafting'
  error.value = ''
  try {
    const draft = await draftStoryFromTranscript(fullTranscript())
    draftTitle.value = draft.title || ''
    draftDescription.value = draft.description || ''
    status.value = 'review'
  } catch (e) {
    error.value = 'No se pudo generar el borrador a partir de la conversación.'
    status.value = 'error'
  }
}

function cancelConversation() {
  stopCapture()
  status.value = 'idle'
  turns.value = []
}

async function saveDraft() {
  saving.value = true
  error.value = ''
  try {
    const id = await createStory({
      title: draftTitle.value,
      description: draftDescription.value,
      imagePrompt: draftImagePrompt.value,
    })
    router.push({ name: 'story-detail', params: { id } })
  } catch (e) {
    error.value = 'No se pudo guardar la historia.'
  } finally {
    saving.value = false
  }
}

onBeforeUnmount(() => {
  stopCapture()
})
</script>

<template>
  <div>
    <h1>Generar historia por voz</h1>
    <p class="muted">
      Cuenta la anécdota de Leo en voz alta, en conversación con Gemini. Al terminar, se genera
      un borrador de título y descripción que puedes revisar antes de guardar.
    </p>

    <div v-if="status === 'idle'" class="card">
      <button class="btn" @click="startConversation">Empezar a hablar</button>
    </div>

    <div v-else-if="status === 'connecting'" class="card">
      <p class="muted">Conectando con Gemini…</p>
    </div>

    <div v-else-if="status === 'listening'" class="card">
      <p class="listening-indicator">🎙️ Escuchando…</p>
      <div class="transcript">
        <p v-for="(turn, i) in turns" :key="i" :class="['turn', turn.speaker]">
          <strong>{{ turn.speaker === 'tu' ? 'Tú' : 'Gemini' }}:</strong> {{ turn.text }}
        </p>
      </div>
      <div class="actions">
        <button class="btn" @click="finishConversation">Terminar y generar borrador</button>
        <button class="btn secondary" @click="cancelConversation">Cancelar</button>
      </div>
    </div>

    <div v-else-if="status === 'drafting'" class="card">
      <p class="muted">Generando borrador…</p>
    </div>

    <form v-else-if="status === 'review'" class="card" @submit.prevent="saveDraft">
      <h2>Revisa el borrador</h2>
      <div class="field">
        <label for="draft-title">Título</label>
        <input id="draft-title" v-model="draftTitle" type="text" required />
      </div>
      <div class="field">
        <label for="draft-description">Descripción</label>
        <textarea id="draft-description" v-model="draftDescription" rows="8" required></textarea>
      </div>
      <div class="field">
        <label for="draft-prompt">Prompt de imagen (opcional, se puede añadir luego)</label>
        <textarea id="draft-prompt" v-model="draftImagePrompt" rows="3"></textarea>
      </div>
      <button class="btn" type="submit" :disabled="saving">
        {{ saving ? 'Guardando…' : 'Guardar historia' }}
      </button>
    </form>

    <p v-if="error" class="error">{{ error }}</p>
  </div>
</template>

<style scoped>
.listening-indicator {
  font-weight: 600;
}

.transcript {
  max-height: 320px;
  overflow-y: auto;
  margin: 1rem 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.turn.tu {
  color: var(--text);
}

.turn.leo {
  color: var(--muted);
}

.actions {
  display: flex;
  gap: 0.75rem;
}
</style>
