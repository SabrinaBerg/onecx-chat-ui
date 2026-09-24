import { Component, effect, ElementRef, EventEmitter, inject, Input, OnDestroy, Output, ViewChild } from '@angular/core'
import { takeUntilDestroyed } from '@angular/core/rxjs-interop'
import { TranslateModule } from '@ngx-translate/core'
import { ButtonModule } from 'primeng/button'
import { TooltipModule } from 'primeng/tooltip'

import { VoiceWaveformComponent } from './voice-waveform.component'
import { VoiceService } from '../../services/voice.service'

@Component({
  selector: 'app-voice',
  templateUrl: './voice.component.html',
  styleUrl: './voice.component.scss',
  standalone: true,
  imports: [ButtonModule, TooltipModule, TranslateModule, VoiceWaveformComponent]
})
export class VoiceComponent implements OnDestroy {
  private readonly voiceService = inject(VoiceService)

  @Input() chatId = ''
  @Input() voiceChatEnabled = false

  @Output() toggleVoiceChat = new EventEmitter<boolean>()
  @Output() userTranscript = new EventEmitter<{ text: string; isFinal: boolean }>()
  @Output() botTranscript = new EventEmitter<{ text: string; spoken: boolean }>()

  @ViewChild('botAudio') botAudioElement?: ElementRef<HTMLAudioElement>

  // Bridge signals from service for the template
  readonly isConnecting = this.voiceService.isConnecting
  readonly isConnected = this.voiceService.isConnected
  readonly isMuted = this.voiceService.isMuted
  readonly micStream = this.voiceService.micStream

  constructor() {
    // Sync bot stream to audio element
    effect(() => {
      const stream = this.voiceService.botStream()
      if (this.botAudioElement?.nativeElement) {
        this.botAudioElement.nativeElement.srcObject = stream ?? null
      }
    })

    // Bridge transcript events
    this.voiceService.userTranscript$
      .pipe(takeUntilDestroyed())
      .subscribe((t) => this.userTranscript.emit({ text: t.text, isFinal: t.isFinal ?? false }))
    this.voiceService.botTranscript$
      .pipe(takeUntilDestroyed())
      .subscribe((t) => this.botTranscript.emit({ text: t.text, spoken: t.spoken ?? false }))
  }

  ngOnDestroy(): void {
    this.voiceService.cleanup()
  }

  async onClick(): Promise<void> {
    if (this.voiceChatEnabled) {
      this.voiceService.cleanup()
      this.toggleVoiceChat.emit(false)
      return
    }

    if (!this.chatId) return

    try {
      await this.voiceService.start(this.chatId)
      this.toggleVoiceChat.emit(true)
    } catch (error) {
      this.toggleVoiceChat.emit(false)
      throw error
    }
  }

  toggleMute(): void {
    this.voiceService.toggleMute()
  }
}
