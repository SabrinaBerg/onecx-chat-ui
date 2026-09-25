import { Component, Input, OnChanges, OnDestroy, SimpleChanges } from '@angular/core'

@Component({
  selector: 'app-voice-waveform',
  templateUrl: './voice-waveform.component.html',
  styleUrl: './voice-waveform.component.scss',
  standalone: true
})
export class VoiceWaveformComponent implements OnChanges, OnDestroy {
  @Input({ required: true }) stream?: MediaStream
  @Input({ required: true }) active = false

  audioLevel = 0
  readonly waveformBars = [0.35, 0.6, 0.9, 0.6, 0.35]
  barLevels = this.waveformBars.map(() => 0.2)

  private audioContext?: AudioContext
  private analyser?: AnalyserNode
  private rafId?: number
  private wavePhase = 0
  private dataArray?: Uint8Array

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['active'] || changes['stream']) {
      if (this.active && this.stream) {
        void this.startAudioMeter(this.stream)
      } else {
        this.stopAudioMeter()
      }
    }
  }

  ngOnDestroy(): void {
    this.stopAudioMeter()
  }

  private async startAudioMeter(stream: MediaStream): Promise<void> {
    if (this.audioContext) return
    try {
      this.audioContext = new AudioContext()
      this.analyser = this.audioContext.createAnalyser()
      this.analyser.fftSize = 1024
      const source = this.audioContext.createMediaStreamSource(stream)
      source.connect(this.analyser)
      const dataArray = new Uint8Array(new ArrayBuffer(this.analyser.fftSize))
      this.dataArray = dataArray
      const update = () => {
        if (!this.analyser || !this.dataArray) return
        this.analyser.getByteTimeDomainData(dataArray)
        let sum = 0
        for (const value of dataArray) {
          const normalized = (value - 128) / 128
          sum += normalized * normalized
        }
        const rms = Math.sqrt(sum / dataArray.length)
        this.audioLevel = Math.min(1, rms * 3.2)
        this.wavePhase += 0.22
        this.barLevels = this.waveformBars.map((weight, index) => {
          const modulation = 0.6 + 0.4 * Math.sin(this.wavePhase + index * 0.7)
          return Math.min(1, 0.08 + this.audioLevel * weight * modulation)
        })
        this.rafId = requestAnimationFrame(update)
      }
      update()
    } catch (error) {
      console.error('Unable to start audio meter:', error)
    }
  }

  private stopAudioMeter(): void {
    if (this.rafId !== undefined) {
      cancelAnimationFrame(this.rafId)
      this.rafId = undefined
    }
    if (this.audioContext) {
      this.audioContext.close()
      this.audioContext = undefined
    }
    this.analyser = undefined
    this.dataArray = undefined
    this.audioLevel = 0
    this.barLevels = this.waveformBars.map(() => 0.2)
  }
}
