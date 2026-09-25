import { ComponentFixture, TestBed } from '@angular/core/testing'
import { TranslateTestingModule } from 'ngx-translate-testing'

import { VoiceComponent } from './voice.component'
import { VoiceService } from '../../services/voice.service'

describe('VoiceComponent', () => {
  let component: VoiceComponent
  let fixture: ComponentFixture<VoiceComponent>
  let voiceService: VoiceService

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        VoiceComponent,
        TranslateTestingModule.withTranslations({
          en: require('./src/assets/i18n/en.json'),
          de: require('./src/assets/i18n/de.json')
        }).withDefaultLanguage('en')
      ],
      providers: [VoiceService]
    }).compileComponents()

    fixture = TestBed.createComponent(VoiceComponent)
    component = fixture.componentInstance
    voiceService = TestBed.inject(VoiceService)
    fixture.detectChanges()
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('should create', () => {
    expect(component).toBeTruthy()
  })

  it('should bridge the voice service signals to the template', () => {
    voiceService.isConnecting.set(true)
    voiceService.isConnected.set(true)
    voiceService.isMuted.set(true)

    expect(component.isConnecting()).toBe(true)
    expect(component.isConnected()).toBe(true)
    expect(component.isMuted()).toBe(true)
  })

  describe('onClick', () => {
    it('should clean up and emit voiceChatStopped when voice chat is already enabled', async () => {
      const cleanup = jest.spyOn(voiceService, 'cleanup')
      const started = jest.spyOn(component.voiceChatStarted, 'emit')
      const stopped = jest.spyOn(component.voiceChatStopped, 'emit')
      component.voiceChatEnabled = true

      await component.onClick()

      expect(cleanup).toHaveBeenCalled()
      expect(stopped).toHaveBeenCalled()
      expect(started).not.toHaveBeenCalled()
    })

    it('should not start a voice session when there is no chat id', async () => {
      const start = jest.spyOn(voiceService, 'start')
      component.chatId = ''

      await component.onClick()

      expect(start).not.toHaveBeenCalled()
    })

    it('should start the voice session and emit voiceChatStarted', async () => {
      const start = jest.spyOn(voiceService, 'start').mockResolvedValue()
      const started = jest.spyOn(component.voiceChatStarted, 'emit')
      component.chatId = 'chat-1'

      await component.onClick()

      expect(start).toHaveBeenCalledWith('chat-1')
      expect(started).toHaveBeenCalled()
    })

    it('should emit voiceChatStopped and rethrow when starting the voice session fails', async () => {
      const failure = new Error('voice start failed')
      const start = jest.spyOn(voiceService, 'start').mockRejectedValue(failure)
      const stopped = jest.spyOn(component.voiceChatStopped, 'emit')
      component.chatId = 'chat-1'

      await expect(component.onClick()).rejects.toThrow('voice start failed')

      expect(start).toHaveBeenCalled()
      expect(stopped).toHaveBeenCalled()
    })
  })

  describe('toggleMute', () => {
    it('should delegate to the voice service', () => {
      const toggleMute = jest.spyOn(voiceService, 'toggleMute')

      component.toggleMute()

      expect(toggleMute).toHaveBeenCalled()
    })
  })

  describe('transcript bridging', () => {
    it('should re-emit user transcripts from the service', () => {
      const emit = jest.spyOn(component.userTranscript, 'emit')

      voiceService.userTranscript$.next({ text: 'hello', isFinal: false })

      expect(emit).toHaveBeenCalledWith({ text: 'hello', isFinal: false })
    })

    it('should re-emit bot transcripts from the service', () => {
      const emit = jest.spyOn(component.botTranscript, 'emit')

      voiceService.botTranscript$.next({ text: 'hi there', spoken: true })

      expect(emit).toHaveBeenCalledWith({ text: 'hi there', spoken: true })
    })

    it('should default to non-final / un-spoken when the field is missing', () => {
      const userEmit = jest.spyOn(component.userTranscript, 'emit')
      const botEmit = jest.spyOn(component.botTranscript, 'emit')

      voiceService.userTranscript$.next({ text: 'partial' } as never)
      voiceService.botTranscript$.next({ text: 'partial' } as never)

      expect(userEmit).toHaveBeenCalledWith({ text: 'partial', isFinal: false })
      expect(botEmit).toHaveBeenCalledWith({ text: 'partial', spoken: false })
    })
  })

  it('should clean up the voice service on destroy', () => {
    const cleanup = jest.spyOn(voiceService, 'cleanup')

    component.ngOnDestroy()

    expect(cleanup).toHaveBeenCalled()
  })

  describe('bot audio sync effect', () => {
    it('should assign the bot stream to the audio element', () => {
      const stream = { getTracks: () => [] } as unknown as MediaStream

      voiceService.botStream.set(stream)
      fixture.detectChanges()

      expect(component.botAudioElement?.nativeElement.srcObject).toBe(stream)
    })

    it('should assign null to the audio element when the bot stream is cleared', () => {
      const stream = { getTracks: () => [] } as unknown as MediaStream
      voiceService.botStream.set(stream)
      fixture.detectChanges()

      voiceService.botStream.set(undefined)
      fixture.detectChanges()

      expect(component.botAudioElement?.nativeElement.srcObject).toBeNull()
    })
  })

  describe('template bindings', () => {
    it('should show the stop recording state when voice chat is enabled', () => {
      fixture.componentRef.setInput('voiceChatEnabled', true)
      fixture.detectChanges()

      expect(fixture.nativeElement.querySelector('app-voice-waveform')).not.toBeNull()
      expect(fixture.nativeElement.querySelector('.voice-record-button')).not.toBeNull()
    })

    it('should hide the waveform when voice chat is disabled', () => {
      fixture.componentRef.setInput('voiceChatEnabled', false)
      fixture.detectChanges()

      expect(fixture.nativeElement.querySelector('app-voice-waveform')).toBeNull()
    })
  })
})
