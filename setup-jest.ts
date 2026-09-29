// setup-jest.ts
import { jest } from '@jest/globals'
import { setupZoneTestEnv } from 'jest-preset-angular/setup-env/zone'

setupZoneTestEnv({
  errorOnUnknownElements: true,
  errorOnUnknownProperties: true
})

/* First, fix the DOM prototype for JSDOM */
Object.defineProperty(HTMLElement.prototype, 'ariaLabel', {
  get() {
    return this.getAttribute('aria-label')
  },
  set(value) {
    this.setAttribute('aria-label', value)
  },
  configurable: true
})

/* Mock matchMedia for tests */
Object.defineProperty(globalThis, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn()
  }))
})

/* Mock ResizeObserver for tests (jsdom does not implement it; PrimeNG uses it in ngAfterViewInit) */
class ResizeObserverMock {
  observe = jest.fn()
  unobserve = jest.fn()
  disconnect = jest.fn()
}
Object.defineProperty(globalThis, 'ResizeObserver', {
  writable: true,
  value: ResizeObserverMock
})

/* fixes a bug with jsdom: ignoring this error message in log */
const originalConsoleError = console.error
type Err = { message: string }
console.error = (message, ...optionalParams) => {
  try {
    if (message?.includes('Error: Could not parse CSS stylesheet')) return
  } catch (err) {
    ;(err as Err).message = `Error in console.error`
    return
  }
  originalConsoleError(message, ...optionalParams)
}
