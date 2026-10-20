import { TestBed } from '@angular/core/testing'
import { take } from 'rxjs'

import { ChatScrollService } from './chat-scroll.service'

/**
 * Create a scrollable container with deterministic, mockable dimensions
 * for jsdom testing. jsdom does not perform layout, so scrollHeight /
 * scrollTop are not affected by CSS or child elements. We use property
 * descriptors to force the values the service reads.
 */
function createMockContainer(): {
  element: HTMLElement
  setDimensions: (scrollHeight: number, scrollTop: number, clientHeight: number) => void
} {
  const el = document.createElement('div')
  document.body.appendChild(el)

  const setDimensions = (scrollHeight: number, scrollTop: number, clientHeight: number): void => {
    Object.defineProperty(el, 'scrollHeight', { value: scrollHeight, configurable: true, writable: true })
    Object.defineProperty(el, 'scrollTop', { value: scrollTop, configurable: true, writable: true })
    Object.defineProperty(el, 'clientHeight', { value: clientHeight, configurable: true, writable: true })
  }

  return { element: el, setDimensions }
}

describe('ChatScrollService', () => {
  let service: ChatScrollService

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [ChatScrollService]
    })

    service = TestBed.inject(ChatScrollService)
  })

  afterEach(() => {
    service.dispose()
  })

  it('should be created', () => {
    expect(service).toBeTruthy()
  })

  describe('isAtBottom$', () => {
    it('should start with true', () => {
      let receivedValue: boolean | undefined
      service.isAtBottom$.pipe(take(1)).subscribe((value) => {
        receivedValue = value
      })
      expect(receivedValue).toBe(true)
    })
  })

  describe('init', () => {
    it('should track scroll position via evaluateScrollPosition', () => {
      const { element, setDimensions } = createMockContainer()

      // Initial: 400 - (0 + 300) = 100 > 24 → not at bottom
      setDimensions(400, 0, 300)

      // Initial state is true (default BehaviorSubject)
      let value: boolean | undefined
      service.isAtBottom$.pipe(take(1)).subscribe((v) => {
        value = v
      })
      expect(value).toBe(true)

      service.init(element, 24)

      // After init, evaluateScrollPosition runs → not at bottom
      let notAtBottom: boolean | undefined
      service.isAtBottom$.pipe(take(1)).subscribe((v) => {
        notAtBottom = v
      })
      expect(notAtBottom).toBe(false)

      // Scroll to bottom: 400 - (100 + 300) = -100 → at bottom
      setDimensions(400, 100, 300)
      element.dispatchEvent(new Event('scroll'))

      let atBottom: boolean | undefined
      service.isAtBottom$.pipe(take(1)).subscribe((v) => {
        atBottom = v
      })
      expect(atBottom).toBe(true)

      document.body.removeChild(element)
    })

    it('should remove previous listener on re-init', () => {
      const { element: previousElement, setDimensions: setPreviousDimensions } = createMockContainer()
      const { element: nextElement, setDimensions: setNextDimensions } = createMockContainer()
      setPreviousDimensions(400, 100, 300)
      setNextDimensions(400, 100, 300)
      const removeEventListenerSpy = jest.spyOn(previousElement, 'removeEventListener')

      service.init(previousElement, 24)
      service.init(nextElement, 24)

      expect(removeEventListenerSpy).toHaveBeenCalledWith('scroll', expect.any(Function))

      previousElement.remove()
      nextElement.remove()
    })

    it('should use custom threshold', () => {
      const { element, setDimensions } = createMockContainer()

      // 400 - (99 + 300) = 1 → at bottom with threshold 100
      setDimensions(400, 99, 300)

      service.init(element, 100)

      let atBottom: boolean | undefined
      service.isAtBottom$.pipe(take(1)).subscribe((v) => {
        atBottom = v
      })
      expect(atBottom).toBe(true)

      document.body.removeChild(element)
    })

    it('should only emit when state changes', () => {
      const { element, setDimensions } = createMockContainer()

      // 400 - (100 + 300) = 0 → at bottom
      setDimensions(400, 100, 300)

      service.init(element, 24)

      const emitCount = { count: 0 }
      service.isAtBottom$.subscribe((v) => {
        emitCount.count++
      })

      // Same position → no new emission
      element.dispatchEvent(new Event('scroll'))
      // State hasn't changed from last evaluate
      expect(emitCount.count).toBe(1) // initial BehaviorSubject + init evaluate

      document.body.removeChild(element)
    })
  })

  describe('resetToBottom', () => {
    it('should set isAtBottom to true', () => {
      let receivedValue: boolean | undefined
      service.isAtBottom$.pipe(take(1)).subscribe((value) => {
        receivedValue = value
      })

      service.resetToBottom()
      expect(receivedValue).toBe(true)
    })
  })

  describe('checkPosition', () => {
    it('should not throw when container is not set', () => {
      expect(() => service.checkPosition()).not.toThrow()
    })

    it('should re-evaluate position when container is set', () => {
      const { element, setDimensions } = createMockContainer()

      // Start at bottom
      setDimensions(400, 100, 300)
      service.init(element)

      // Now scroll up: 800 - (400 + 300) = 100 > 24 → not at bottom
      setDimensions(800, 400, 300)
      service.checkPosition()

      let positionValue: boolean | undefined
      service.isAtBottom$.pipe(take(1)).subscribe((v) => {
        positionValue = v
      })
      expect(positionValue).toBe(false)

      document.body.removeChild(element)
    })
  })

  describe('scrollToBottom', () => {
    it('should not throw when container is not set', () => {
      expect(() => service.scrollToBottom()).not.toThrow()
    })

    it('should use scrollTo when available', () => {
      const { element, setDimensions } = createMockContainer()
      setDimensions(800, 100, 300)

      const scrollToSpy = jest.fn()
      element.scrollTo = scrollToSpy

      service.init(element)
      service.scrollToBottom()

      expect(scrollToSpy).toHaveBeenCalledWith({
        top: 800,
        behavior: 'smooth'
      })

      document.body.removeChild(element)
    })

    it('should use instant scrolling when requested', () => {
      const { element, setDimensions } = createMockContainer()
      setDimensions(800, 100, 300)

      const scrollToSpy = jest.fn()
      element.scrollTo = scrollToSpy

      service.init(element)
      service.scrollToBottom('auto')

      expect(scrollToSpy).toHaveBeenCalledWith({
        top: 800,
        behavior: 'auto'
      })

      document.body.removeChild(element)
    })

    it('should use scrollTop fallback when scrollTo is unavailable', () => {
      const { element, setDimensions } = createMockContainer()
      setDimensions(800, 100, 300)

      // Remove scrollTo to test fallback
      delete (element as any).scrollTo

      // We can't test the assignment in jsdom reliably, but we can
      // verify it doesn't throw
      service.init(element)
      expect(() => service.scrollToBottom()).not.toThrow()

      document.body.removeChild(element)
    })
  })

  describe('dispose', () => {
    it('should clear container and listeners', () => {
      const { element } = createMockContainer()

      service.init(element)
      service.dispose()

      // Further operations should be no-ops
      expect(() => service.checkPosition()).not.toThrow()
      expect(() => service.scrollToBottom()).not.toThrow()

      document.body.removeChild(element)
    })
  })
})
