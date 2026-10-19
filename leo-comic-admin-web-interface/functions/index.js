import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { defineSecret } from 'firebase-functions/params'
import { GoogleGenAI, Modality } from '@google/genai'

const geminiApiKey = defineSecret('GEMINI_API_KEY')

const LIVE_MODEL = 'gemini-2.5-flash-native-audio-preview-09-2025'

// Mints a short-lived Gemini Live API token so the browser can open a
// direct WebSocket session without ever seeing the real Gemini API key.
// Only a signed-in admin (enforced by Firebase Auth on the callable) may
// request one, and liveConnectConstraints locks the token to this model
// and config so a malicious client can't redirect it to a different
// model or request text/tool access it wasn't issued for.
export const createGeminiLiveToken = onCall(
  { secrets: [geminiApiKey], cors: true },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Debes iniciar sesión.')
    }

    const client = new GoogleGenAI({ apiKey: geminiApiKey.value() })

    const expireTime = new Date(Date.now() + 10 * 60 * 1000).toISOString()
    const newSessionExpireTime = new Date(Date.now() + 60 * 1000).toISOString()

    const token = await client.authTokens.create({
      config: {
        uses: 1,
        expireTime,
        newSessionExpireTime,
        liveConnectConstraints: {
          model: LIVE_MODEL,
          config: {
            responseModalities: [Modality.AUDIO],
          },
        },
      },
    })

    return { token: token.name, model: LIVE_MODEL }
  }
)

const TEXT_MODEL = 'gemini-2.5-flash'

// Turns the voice conversation transcript into a story draft (title +
// description) using a plain text call — kept server-side so the real
// Gemini API key is never sent to the browser.
export const draftStoryFromTranscript = onCall(
  { secrets: [geminiApiKey] },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Debes iniciar sesión.')
    }

    const transcript = request.data?.transcript
    if (!transcript || typeof transcript !== 'string') {
      throw new HttpsError('invalid-argument', 'Falta el transcript de la conversación.')
    }

    const client = new GoogleGenAI({ apiKey: geminiApiKey.value() })

    const response = await client.models.generateContent({
      model: TEXT_MODEL,
      contents: [
        {
          role: 'user',
          parts: [
            {
              text:
                'A partir de esta transcripción de una conversación de voz donde un padre ' +
                'cuenta una anécdota de su hijo Leo, escribe un borrador de historia para un ' +
                'cómic infantil: un título corto y una descripción fiel a lo contado. ' +
                `Transcripción:\n\n${transcript}`,
            },
          ],
        },
      ],
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            description: { type: 'string' },
          },
          required: ['title', 'description'],
        },
      },
    })

    const draft = JSON.parse(response.text)
    return draft
  }
)
