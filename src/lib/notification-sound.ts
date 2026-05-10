export const TASKIT_NOTIFICATION_SOUND_URL = '/sounds/taskitnot.m4a'

const SOUND_COOLDOWN_MS = 900
let lastPlayedAt = 0
let unlockRegistered = false
let unlocked = false

function canUseAudio() {
  return typeof window !== 'undefined' && typeof Audio !== 'undefined'
}

function createNotificationAudio() {
  const audio = new Audio(TASKIT_NOTIFICATION_SOUND_URL)
  audio.preload = 'auto'
  audio.volume = 0.85
  return audio
}

export async function playTaskitNotificationSound(options: { force?: boolean } = {}) {
  if (!canUseAudio()) return false

  const now = Date.now()
  if (!options.force && now - lastPlayedAt < SOUND_COOLDOWN_MS) {
    return false
  }

  lastPlayedAt = now

  try {
    const audio = createNotificationAudio()
    await audio.play()
    return true
  } catch {
    return false
  }
}

export function registerTaskitNotificationSoundUnlock() {
  if (!canUseAudio() || unlockRegistered) return
  unlockRegistered = true

  const unlock = () => {
    if (unlocked) return
    unlocked = true

    const audio = createNotificationAudio()
    audio.muted = true
    void audio.play()
      .then(() => {
        audio.pause()
        audio.currentTime = 0
      })
      .catch(() => {
        unlocked = false
      })
  }

  window.addEventListener('pointerdown', unlock, { once: true, passive: true })
  window.addEventListener('keydown', unlock, { once: true })
  window.addEventListener('touchstart', unlock, { once: true, passive: true })
}
