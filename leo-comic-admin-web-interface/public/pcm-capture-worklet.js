// AudioWorklet that converts the mic's Float32 frames into 16-bit PCM
// chunks and posts them to the main thread for streaming to Gemini.
class PcmCaptureProcessor extends AudioWorkletProcessor {
  process(inputs) {
    const channel = inputs[0]?.[0]
    if (channel && channel.length) {
      const pcm16 = new Int16Array(channel.length)
      for (let i = 0; i < channel.length; i++) {
        const sample = Math.max(-1, Math.min(1, channel[i]))
        pcm16[i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff
      }
      this.port.postMessage(pcm16.buffer, [pcm16.buffer])
    }
    return true
  }
}

registerProcessor('pcm-capture-processor', PcmCaptureProcessor)
