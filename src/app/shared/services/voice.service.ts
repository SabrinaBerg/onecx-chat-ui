import { Injectable, OnDestroy, signal } from '@angular/core'
import { Subject } from 'rxjs'

export interface Transcript {
  text: string
  isFinal?: boolean
  spoken?: boolean
}

/**
 * Voice backend client.
 *
 * NOTE(#789): the real pipecat/voice-BFF WebSocket integration is intentionally
 * mocked out for now. `start()` simulates a connection delay and drives the UI
 * state (connecting/connected/muted) plus the local microphone stream used for
 * the waveform. It then plays a scripted user/bot transcript exchange through
 * the `userTranscript$`/`botTranscript$` Subjects so the full voice-conversation
 * UI is demonstrable. A real backend would instead push live transcripts.
 */
@Injectable({ providedIn: 'root' })
export class VoiceService implements OnDestroy {
  // State signals
  readonly isConnecting = signal(false)
  readonly isConnected = signal(false)
  readonly isMuted = signal(false)
  readonly micStream = signal<MediaStream | undefined>(undefined)
  readonly botStream = signal<MediaStream | undefined>(undefined)

  // Transcript subjects — the mock emits a scripted exchange through these.
  readonly userTranscript$ = new Subject<Transcript>()
  readonly botTranscript$ = new Subject<Transcript>()

  private micStreamIsOwned = false
  private timers: Array<ReturnType<typeof setTimeout>> = []

  async start(chatId: string): Promise<void> {
    if (this.isConnected()) return

    this.isConnecting.set(true)

    // Simulate backend connection latency. A real client would establish the
    // WebSocket to the voice BFF here.
    this.schedule(() => {
      this.isConnecting.set(false)
      this.isConnected.set(true)
      this.isMuted.set(false)
      void this.acquireMic()
      this.runScriptedExchange()
    }, 600)
  }

  toggleMute(): void {
    this.isMuted.update((v) => !v)
  }

  cleanup(): void {
    for (const timer of this.timers) {
      clearTimeout(timer)
    }
    this.timers = []

    this.stopMicStream()
    this.botStream.set(undefined)

    this.isConnecting.set(false)
    this.isConnected.set(false)
    this.isMuted.set(false)
    this.userTranscript$.next({ text: '', isFinal: false })
  }

  ngOnDestroy(): void {
    this.cleanup()
  }

  /**
   * Requests the local microphone for the waveform visualization. This is pure
   * UI (not the backend). A failure must never block the connect flow — if the
   * mic is unavailable (permission denied, no device, insecure context) the
   * waveform simply stays idle.
   */
  private async acquireMic(): Promise<void> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      this.micStreamIsOwned = true
      this.micStream.set(stream)
    } catch (error) {
      console.warn('Voice: unable to access microphone, waveform will stay idle:', error)
      this.micStream.set(undefined)
    }
  }

  /**
   * Plays a short scripted conversation so the mock is demonstrable end to
   * end. Real user/bot transcripts from the backend would arrive through the
   * same Subjects with the same event shapes.
   */
  private runScriptedExchange(): void {
    const userText = 'This is a mock message to show the voice chat UI.'
    const botText = 'Once the voice backend is implemented, this mock conversation will be replaced. Stay tuned.'

    const userChunks = splitIntoChunks(userText)
    userChunks.forEach((chunk, i) => {
      this.schedule(
        () => {
          this.userTranscript$.next({
            text: userChunks.slice(0, i + 1).join(' '),
            isFinal: false
          })
        },
        1400 + i * 420
      )
    })
    this.schedule(
      () => {
        this.userTranscript$.next({ text: userText, isFinal: true })
      },
      1400 + userChunks.length * 420
    )

    // The bot replies, streamed into the same message.
    // A real backend marks sentences that have already been read aloud with
    // `spoken: true` so the reducer skips them (they arrive again via the
    // normal message flow once the stream ends) — see the reducer spec for that
    // path. Here the sentence is un-spoken so it renders in the bubble.
    const botBase = 3600
    const botSentences = botText.split('. ').map((s) => s + (s.endsWith('.') ? '' : '.'))
    botSentences.forEach((sentence, i) => {
      this.schedule(
        () => {
          this.botTranscript$.next({ text: sentence, spoken: false })
        },
        botBase + i * 900
      )
    })
  }

  private schedule(fn: () => void, delay: number): void {
    this.timers.push(setTimeout(fn, delay))
  }

  private stopMicStream(): void {
    const micStream = this.micStream()
    if (micStream && this.micStreamIsOwned) {
      for (const track of micStream.getTracks()) {
        track.stop()
      }
    }
    this.micStream.set(undefined)
    this.micStreamIsOwned = false
  }
}

function splitIntoChunks(text: string, size = 4): string[] {
  const words = text.split(/\s+/).filter(Boolean)
  const chunks: string[] = []
  for (let i = 0; i < words.length; i += size) {
    chunks.push(words.slice(i, i + size).join(' '))
  }
  return chunks
}
