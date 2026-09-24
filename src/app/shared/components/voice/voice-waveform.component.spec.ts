import { SimpleChanges, SimpleChange } from '@angular/core'
import { ComponentFixture, TestBed } from '@angular/core/testing'

import { VoiceWaveformComponent } from './voice-waveform.component'

/**
 * jsdom has no AudioContext. This minimal fake drives the component's meter
 * code: it exposes the surface the component uses, and records the created
 * instance so a test can assert the context was closed.
 */
class FakeAnalyser {
  fftSize = 1024
  getByteTimeDomainData(data: Uint8Array): void {
    // Leave the buffer as-is (all zeros) so the component computes a stable level.
    data.fill(0)
  }
}

class FakeSource {
  // No-op source: the component only needs to be able to call connect().
  connect = jest.fn()
}

class FakeAudioContext {
  static instance?: FakeAudioContext
  readonly close = jest.fn()

  static create(): FakeAudioContext {
    const ctx = new FakeAudioContext()
    FakeAudioContext.instance = ctx
    return ctx
  }

  createAnalyser(): FakeAnalyser {
    return new FakeAnalyser()
  }

  createMediaStreamSource(_stream: MediaStream): FakeSource {
    return new FakeSource()
  }
}

describe('VoiceWaveformComponent', () => {
  let fixture: ComponentFixture<VoiceWaveformComponent>
  let component: VoiceWaveformComponent
  let rafCallbacks: Array<FrameRequestCallback>

  const createFakeStream = (): MediaStream => ({ getTracks: () => [] }) as unknown as MediaStream

  const activeChanges = (): SimpleChanges => ({ active: new SimpleChange(false, true, true) })

  const installContext = (): jest.Mock => {
    const spy = jest.fn(() => FakeAudioContext.create())
    global.AudioContext = spy as unknown as typeof AudioContext
    return spy
  }

  beforeEach(() => {
    rafCallbacks = []
    Object.defineProperty(window, 'requestAnimationFrame', {
      value: (cb: FrameRequestCallback) => {
        rafCallbacks.push(cb)
        return rafCallbacks.length
      },
      writable: true
    })
    Object.defineProperty(window, 'cancelAnimationFrame', { value: jest.fn(), writable: true })

    TestBed.configureTestingModule({ imports: [VoiceWaveformComponent] })
    fixture = TestBed.createComponent(VoiceWaveformComponent)
    component = fixture.componentInstance
  })

  it('should be created', () => {
    expect(component).toBeTruthy()
    expect(component.barLevels).toEqual([0.2, 0.2, 0.2, 0.2, 0.2])
  })

  it('should be a no-op when the active flag does not change', () => {
    const spy = installContext()
    component.active = true
    component.stream = createFakeStream()

    component.ngOnChanges({})

    expect(spy).not.toHaveBeenCalled()
  })

  it('should start the audio meter when active and a stream are present', () => {
    const spy = installContext()
    component.active = true
    component.stream = createFakeStream()

    component.ngOnChanges(activeChanges())

    expect(spy).toHaveBeenCalledTimes(1)
    // The meter ran once synchronously, producing animated bar levels.
    expect(component.barLevels).toHaveLength(5)
    expect(component.barLevels[0]).toBeGreaterThan(0.2)
    // A further frame was scheduled.
    expect(rafCallbacks.length).toBeGreaterThan(0)
  })

  it('should only start the meter once when changed again', () => {
    const spy = installContext()
    component.active = true
    component.stream = createFakeStream()

    component.ngOnChanges(activeChanges())
    component.ngOnChanges(activeChanges())

    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('should stop the meter when the stream is removed', () => {
    installContext()
    component.active = true
    component.stream = createFakeStream()
    component.ngOnChanges(activeChanges())

    const close = FakeAudioContext.instance?.close
    expect(close).toBeDefined()

    component.stream = undefined
    component.ngOnChanges({ stream: new SimpleChange(createFakeStream(), undefined, true) })

    expect(close).toHaveBeenCalled()
    expect(component.audioLevel).toBe(0)
    expect(component.barLevels).toEqual([0.2, 0.2, 0.2, 0.2, 0.2])
  })

  it('should fall back to an idle meter if the audio context throws', () => {
    const error = jest.spyOn(console, 'error').mockImplementation(() => undefined)
    global.AudioContext = jest.fn(() => {
      throw new Error('no audio')
    }) as unknown as typeof AudioContext
    component.active = true
    component.stream = createFakeStream()

    expect(() => component.ngOnChanges(activeChanges())).not.toThrow()

    expect(error).toHaveBeenCalled()
    expect(component.barLevels).toEqual([0.2, 0.2, 0.2, 0.2, 0.2])
  })

  it('should advance the meter on requestAnimationFrame', () => {
    installContext()
    component.active = true
    component.stream = createFakeStream()
    component.ngOnChanges(activeChanges())

    const before = component.barLevels.slice()
    const firstFrame = rafCallbacks[0]
    expect(firstFrame).toBeDefined()
    firstFrame(0)

    expect(component.audioLevel).toBeGreaterThanOrEqual(0)
    // The phase advanced, so at least one bar differs from the first frame.
    expect(component.barLevels).not.toEqual(before)
  })

  it('should clean up on destroy', () => {
    installContext()
    component.active = true
    component.stream = createFakeStream()
    component.ngOnChanges(activeChanges())

    const close = FakeAudioContext.instance?.close
    component.ngOnDestroy()

    expect(close).toHaveBeenCalled()
    expect(component.audioLevel).toBe(0)
  })

  it('should ignore scheduled frames once the meter has stopped', () => {
    installContext()
    component.active = true
    component.stream = createFakeStream()
    component.ngOnChanges(activeChanges())

    const pendingFrame = rafCallbacks[0]
    expect(pendingFrame).toBeDefined()

    // Cleanup clears the analyser/dataArray, so the pending frame must bail out early.
    component.ngOnDestroy()
    expect(() => pendingFrame(0)).not.toThrow()
    expect(component.audioLevel).toBe(0)
  })
})
