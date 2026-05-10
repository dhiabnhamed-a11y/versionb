export const TASKIT_NOTIFICATION_SOUND_URL = '/sounds/taskitnot.m4a'

const SOUND_COOLDOWN_MS = 900
let lastPlayedAt = 0
let unlockRegistered = false
let unlocked = false
let sharedAudio: HTMLAudioElement | null = null
let pendingPlay = false

function canUseAudio() {
  return typeof window !== 'undefined' && typeof Audio !== 'undefined'
}

function createNotificationAudio() {
  const audio = new Audio(TASKIT_NOTIFICATION_SOUND_URL)
  audio.preload = 'auto'
  audio.volume = 0.85
  return audio
}

function getNotificationAudio() {
  if (!canUseAudio()) return null
  sharedAudio ??= createNotificationAudio()
  return sharedAudio
}

async function tryPlay(audio: HTMLAudioElement, muted: boolean) {
  audio.pause()
  audio.currentTime = 0
  audio.muted = muted
  await audio.play()
}

export async function playTaskitNotificationSound(options: { force?: boolean } = {}) {
  if (!canUseAudio()) return false

  const now = Date.now()
  if (!options.force && now - lastPlayedAt < SOUND_COOLDOWN_MS) {
    return false
  }

  lastPlayedAt = now

  try {
    const audio = getNotificationAudio()
    if (!audio) return false
    await tryPlay(audio, false)
    pendingPlay = false
    return true
  } catch {
    pendingPlay = true
    return false
  }
}

export function registerTaskitNotificationSoundUnlock() {
  if (!canUseAudio() || unlockRegistered) return
  unlockRegistered = true

  const unlock = async () => {
    if (unlocked) return
    const audio = getNotificationAudio()
    if (!audio) return

    try {
      await tryPlay(audio, true)
      audio.pause()
      audio.currentTime = 0
      audio.muted = false
      unlocked = true

      if (pendingPlay) {
        pendingPlay = false
        void playTaskitNotificationSound({ force: true })
      }
    } catch {
      unlocked = false
    }
  }

  window.addEventListener('pointerdown', unlock, { passive: true })
  window.addEventListener('keydown', unlock)
  window.addEventListener('touchstart', unlock, { passive: true })
}
