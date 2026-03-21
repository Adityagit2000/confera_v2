// Maps text to a sequence of mouth-open values (0-1) over time
// Simple phoneme-based approximation

const OPEN_PHONEMES = new Set([
  'a', 'e', 'i', 'o', 'u',
  'A', 'E', 'I', 'O', 'U'
])

const HALF_OPEN = new Set([
  'b', 'd', 'g', 'j', 'l',
  'n', 'r', 'v', 'w', 'y', 'z'
])

export interface LipSyncFrame {
  time: number
  value: number // 0-1 mouth openness
}

export function textToLipSync(text: string): LipSyncFrame[] {
  const frames: LipSyncFrame[] = []
  const charDuration = 0.075 // seconds per character
  let time = 0

  for (const char of text) {
    let value = 0
    if (OPEN_PHONEMES.has(char)) {
      value = 0.6 + Math.random() * 0.4
    } else if (HALF_OPEN.has(char)) {
      value = 0.2 + Math.random() * 0.3
    } else if (char === ' ' || char === ',' || char === '.') {
      value = 0
    } else {
      value = 0.1 + Math.random() * 0.2
    }

    frames.push({ time, value })
    time += charDuration
  }

  // Add closing frame at end
  frames.push({ time, value: 0 })
  return frames
}

export function getMouthOpenAtTime(
  frames: LipSyncFrame[],
  currentTime: number
): number {
  if (frames.length === 0) return 0

  // Find surrounding frames
  let prevFrame = frames[0]
  let nextFrame = frames[frames.length - 1]

  for (let i = 0; i < frames.length - 1; i++) {
    if (
      frames[i].time <= currentTime &&
      frames[i + 1].time > currentTime
    ) {
      prevFrame = frames[i]
      nextFrame = frames[i + 1]
      break
    }
  }

  if (currentTime >= nextFrame.time) return nextFrame.value

  // Linear interpolation between frames
  const t =
    (currentTime - prevFrame.time) /
    (nextFrame.time - prevFrame.time)
  return prevFrame.value + (nextFrame.value - prevFrame.value) * t
}
