import { DestroyRef, Injectable, inject } from '@angular/core'
import { BehaviorSubject, Observable } from 'rxjs'

/**
 * Manages scroll position detection and smooth scrolling for chat containers.
 *
 * Tracks whether the user is near the bottom of a scrollable container
 * and provides methods to scroll smoothly to the latest content.
 * Uses a configurable threshold percentage to determine "near bottom" state.
 */
@Injectable({ providedIn: 'root' })
export class ChatScrollService {
  private readonly destroyRef = inject(DestroyRef)

  private readonly isAtBottomSubject = new BehaviorSubject<boolean>(true)
  private scrollContainer: HTMLElement | null = null
  private scrollListener: ((event: Event) => void) | null = null

  /** Default threshold: user is "at bottom" when within 24px of the bottom */
  private readonly defaultBottomThreshold = 24

  /**
   * Observable that emits the current "at bottom" state.
   * True means the user is viewing the latest content;
   * false means the user has scrolled up.
   */
  public isAtBottom$: Observable<boolean> = this.isAtBottomSubject.asObservable()

  /**
   * Initializes the service with a scrollable container element.
   * Attaches a scroll listener to track position changes.
   */
  public init(container: HTMLElement, bottomThreshold = this.defaultBottomThreshold): void {
    // Remove any existing listener to prevent duplicates
    this.removeScrollListener()
    this.scrollContainer = container

    const check = (): void => this.evaluateScrollPosition(container, bottomThreshold)
    check() // initial evaluation

    // Store the listener reference so we can remove it later
    this.scrollListener = (event: Event): void => check()
    container.addEventListener('scroll', this.scrollListener)

    // Clean up when the consuming component is destroyed
    this.destroyRef.onDestroy(() => {
      this.removeScrollListener()
      this.scrollContainer = null
    })
  }

  /**
   * Resets the isAtBottom state to true without checking the actual DOM.
   * Call this after a programmatic scroll so consumers know the view is at bottom.
   */
  public resetToBottom(): void {
    this.isAtBottomSubject.next(true)
  }

  /**
   * Forces an evaluation of the current scroll position.
   * Call this after content changes (new messages, loading state, etc.).
   */
  public checkPosition(): void {
    if (!this.scrollContainer) return
    this.evaluateScrollPosition(this.scrollContainer)
  }

  /**
   * Scrolls the container to the bottom smoothly.
   * Falls back to direct scrollTop assignment if scrollTo is not available.
   */
  public scrollToBottom(behavior: ScrollBehavior = 'smooth'): void {
    const container = this.scrollContainer
    if (!container) return

    const top = container.scrollHeight
    if (container.scrollTo) {
      container.scrollTo({ top, behavior })
    } else {
      container.scrollTop = top
    }
  }

  /**
   * Disposes all listeners and clears internal state.
   * Normally handled automatically via DestroyRef, but available for manual cleanup.
   */
  public dispose(): void {
    this.removeScrollListener()
    this.scrollContainer = null
  }

  private removeScrollListener(): void {
    if (this.scrollContainer && this.scrollListener) {
      this.scrollContainer.removeEventListener('scroll', this.scrollListener)
      this.scrollListener = null
    }
  }

  private evaluateScrollPosition(container: HTMLElement, threshold: number = this.defaultBottomThreshold): void {
    const distanceToBottom = container.scrollHeight - (container.scrollTop + container.clientHeight)
    const wasAtBottom = this.isAtBottomSubject.value
    const isAtBottom = distanceToBottom <= threshold

    // Only emit if the state actually changed
    if (isAtBottom !== wasAtBottom) {
      this.isAtBottomSubject.next(isAtBottom)
    }
  }
}
