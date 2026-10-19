import { httpsCallable } from 'firebase/functions'
import { GoogleGenAI, Modality } from '@google/genai'
import { functions } from './firebase'

const SYSTEM_INSTRUCTION = `Eres un asistente que ayuda a un padre a convertir, en voz alta y en
varios turnos de conversación, una anécdota de su hijo Leo en una historia corta para un cómic.
Haz preguntas breves para sacar detalles (qué pasó, dónde, quién más estaba, cómo terminó) hasta
tener suficiente para un borrador. No generes nunca el título o la descripción final en voz: esa
parte se hace aparte con una llamada de texto.`

async function getLiveToken() {
  const createToken = httpsCallable(functions, 'createGeminiLiveToken')
  const { data } = await createToken()
  return data
}

// Opens a Gemini Live voice session using a short-lived token minted by
// our Cloud Function, so the real Gemini API key never reaches the browser.
export async function startLiveSession(callbacks) {
  const { token, model } = await getLiveToken()
  const ai = new GoogleGenAI({ apiKey: token })

  const session = await ai.live.connect({
    model,
    config: {
      responseModalities: [Modality.AUDIO],
      systemInstruction: SYSTEM_INSTRUCTION,
      inputAudioTranscription: {},
      outputAudioTranscription: {},
    },
    callbacks,
  })

  return session
}

// After the voice conversation ends, asks Gemini (via a plain text call,
// no live session / no API key exposure) to turn the transcript into a
// draft title + description for the review screen.
export async function draftStoryFromTranscript(transcript) {
  const draftFromTranscript = httpsCallable(functions, 'draftStoryFromTranscript')
  const { data } = await draftFromTranscript({ transcript })
  return data
}
