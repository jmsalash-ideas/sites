const INPUT_SAMPLE_RATE = 16000
const OUTPUT_SAMPLE_RATE = 24000

export function pcm16ToBase64(arrayBuffer) {
  let binary = ''
  const bytes = new Uint8Array(arrayBuffer)
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

function base64ToInt16Array(base64) {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return new Int16Array(bytes.buffer)
}

// Captures microphone audio as 16kHz PCM16 chunks, delivered via onChunk
// as base64 strings ready for Gemini Live's sendRealtimeInput.
export async function startMicCapture(onChunk) {
  const audioContext = new AudioContext({ sampleRate: INPUT_SAMPLE_RATE })
  await audioContext.audioWorklet.addModule('/pcm-capture-worklet.js')

  const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
  const source = audioContext.createMediaStreamSource(stream)
  const worklet = new AudioWorkletNode(audioContext, 'pcm-capture-processor')

  worklet.port.onmessage = (event) => {
    onChunk(pcm16ToBase64(event.data))
  }

  source.connect(worklet)

  return {
    stop() {
      worklet.port.onmessage = null
      source.disconnect()
      worklet.disconnect()
      stream.getTracks().forEach((track) => track.stop())
      audioContext.close()
    },
  }
}

// Plays back base64 PCM16 chunks from Gemini (24kHz) back-to-back.
export function createAudioPlayer() {
  const audioContext = new AudioContext({ sampleRate: OUTPUT_SAMPLE_RATE })
  let nextStartTime = 0

  function enqueue(base64Pcm) {
    const int16 = base64ToInt16Array(base64Pcm)
    const float32 = new Float32Array(int16.length)
    for (let i = 0; i < int16.length; i++) {
      float32[i] = int16[i] / 0x8000
    }

    const buffer = audioContext.createBuffer(1, float32.length, OUTPUT_SAMPLE_RATE)
    buffer.copyToChannel(float32, 0)

    const source = audioContext.createBufferSource()
    source.buffer = buffer
    source.connect(audioContext.destination)

    const startAt = Math.max(audioContext.currentTime, nextStartTime)
    source.start(startAt)
    nextStartTime = startAt + buffer.duration
  }

  function reset() {
    nextStartTime = 0
  }

  function close() {
    audioContext.close()
  }

  return { enqueue, reset, close }
}
