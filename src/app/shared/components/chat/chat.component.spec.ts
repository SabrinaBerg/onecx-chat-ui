import { SimpleChange } from '@angular/core'
import { ComponentFixture, TestBed } from '@angular/core/testing'
import { TranslateTestingModule } from 'ngx-translate-testing'

import { AngularAcceleratorModule } from '@onecx/angular-accelerator'

import { ChatScrollService } from '../../services/chat-scroll.service'
import { ChatComponent } from './chat.component'
import { ChatMessage } from './chat.viewmodel'

function createMessage(id: string): ChatMessage {
  return {
    creationDate: new Date('2026-08-27T12:00:00Z'),
    id,
    type: 'HUMAN' as any,
    text: `Message ${id}`,
    userName: 'test-user'
  }
}

function setScrollDimensions(
  element: HTMLElement,
  dimensions: { scrollHeight: number; scrollTop: number; clientHeight: number }
): void {
  Object.defineProperty(element, 'scrollHeight', {
    value: dimensions.scrollHeight,
    configurable: true,
    writable: true
  })
  Object.defineProperty(element, 'scrollTop', {
    value: dimensions.scrollTop,
    configurable: true,
    writable: true
  })
  Object.defineProperty(element, 'clientHeight', {
    value: dimensions.clientHeight,
    configurable: true,
    writable: true
  })
  delete (element as any).scrollTo
}

describe('ChatComponent', () => {
  let component: ChatComponent
  let fixture: ComponentFixture<ChatComponent>

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        ChatComponent,
        AngularAcceleratorModule,
        TranslateTestingModule.withTranslations({
          en: require('./src/assets/i18n/en.json'),
          de: require('./src/assets/i18n/de.json')
        }).withDefaultLanguage('en')
      ]
    }).compileComponents()

    fixture = TestBed.createComponent(ChatComponent)
    component = fixture.componentInstance
    fixture.detectChanges()
  })

  it('should create', () => {
    expect(component).toBeTruthy()
  })

  describe('agentsForDropdown', () => {
    it('should map agents to dropdown format', () => {
      component.agents = [
        {
          id: 'agent-1',
          labelKey: 'CHAT.AGENT.ONE'
        } as any,
        {
          id: 'agent-2',
          labelKey: 'CHAT.AGENT.TWO'
        } as any
      ]

      expect(component.agentsForDropdown).toEqual([
        {
          id: 'agent-1',
          labelKey: 'CHAT.AGENT.ONE'
        },
        {
          id: 'agent-2',
          labelKey: 'CHAT.AGENT.TWO'
        }
      ])
    })
  })

  describe('sendButtonClicked', () => {
    it('should emit sendMessage when form has valid message', () => {
      const testMessage = 'Test message'
      jest.spyOn(component.sendMessage, 'emit')

      component.formGroup.patchValue({ message: testMessage })
      component.sendButtonClicked()

      expect(component.sendMessage.emit).toHaveBeenCalledWith(testMessage)
      expect(component.formGroup.value.message).toBeNull()
    })

    it('should not emit sendMessage when message is null', () => {
      jest.spyOn(component.sendMessage, 'emit')

      component.formGroup.patchValue({ message: null })
      component.sendButtonClicked()

      expect(component.sendMessage.emit).not.toHaveBeenCalled()
    })

    it('should not emit sendMessage when message is empty string', () => {
      jest.spyOn(component.sendMessage, 'emit')

      component.formGroup.patchValue({ message: '' })
      component.sendButtonClicked()

      expect(component.sendMessage.emit).not.toHaveBeenCalled()
    })

    it('should not emit sendMessage when message is only whitespace', () => {
      jest.spyOn(component.sendMessage, 'emit')

      component.formGroup.patchValue({ message: '   ' })
      component.sendButtonClicked()

      expect(component.sendMessage.emit).toHaveBeenCalledWith('   ')
      expect(component.formGroup.value.message).toBeNull()
    })

    it('should reset form after sending message', () => {
      const testMessage = 'Test message'
      jest.spyOn(component.sendMessage, 'emit')
      jest.spyOn(component.formGroup, 'reset')

      component.formGroup.patchValue({ message: testMessage })
      component.sendButtonClicked()

      expect(component.formGroup.reset).toHaveBeenCalled()
    })

    it('should not emit sendMessage when sendMessageDisabled is true', () => {
      component.sendMessageDisabled = true
      jest.spyOn(component.sendMessage, 'emit')

      component.formGroup.patchValue({ message: 'Test message' })
      component.sendButtonClicked()

      expect(component.sendMessage.emit).not.toHaveBeenCalled()
    })
  })

  describe('template bindings', () => {
    it('should disable the textarea when sendMessageDisabled input is true', () => {
      fixture.componentRef.setInput('sendMessageDisabled', true)
      fixture.detectChanges()

      const textarea: HTMLTextAreaElement = fixture.nativeElement.querySelector('.message-input')

      expect(textarea.disabled).toBe(true)
    })
  })

  describe('retrySending', () => {
    it('should emit retrySendMessage with message text', () => {
      const testMessage = {
        text: 'Retry this message',
        creationDate: new Date(),
        id: '1',
        type: 'USER' as any,
        userName: 'testUser'
      }
      jest.spyOn(component.retrySendMessage, 'emit')

      component.retrySending(testMessage)

      expect(component.retrySendMessage.emit).toHaveBeenCalledWith('Retry this message')
    })

    it('should handle empty message text', () => {
      const testMessage = {
        text: '',
        creationDate: new Date(),
        id: '2',
        type: 'USER' as any,
        userName: 'testUser'
      }
      jest.spyOn(component.retrySendMessage, 'emit')

      component.retrySending(testMessage)

      expect(component.retrySendMessage.emit).toHaveBeenCalledWith('')
    })
  })

  describe('auto-scroll', () => {
    let scrollContainer: HTMLElement
    let scrollService: ChatScrollService

    beforeEach(() => {
      scrollContainer = fixture.nativeElement.querySelector('.chat-history-container')
      scrollService = fixture.debugElement.injector.get(ChatScrollService)
      fixture.componentRef.setInput('chatId', 'chat-1')
      fixture.componentRef.setInput('chatMessages', [createMessage('1')])
      fixture.detectChanges()
    })

    it('should ignore changes unrelated to the chat and its messages', () => {
      component.unreadCount = 2

      component.ngOnChanges({ sendMessageDisabled: new SimpleChange(false, true, false) })

      expect(component.unreadCount).toBe(2)
    })

    it('should scroll after the initial messages render without a chat id change', () => {
      setScrollDimensions(scrollContainer, { scrollHeight: 800, scrollTop: 100, clientHeight: 300 })

      component.ngOnChanges({ chatMessages: new SimpleChange(undefined, [createMessage('2')], true) })
      component.ngAfterViewChecked()

      expect(scrollContainer.scrollTop).toBe(800)
    })

    it('should ignore a message replacement that does not increase the message count', () => {
      setScrollDimensions(scrollContainer, { scrollHeight: 800, scrollTop: 100, clientHeight: 300 })
      scrollService.checkPosition()

      fixture.componentRef.setInput('chatMessages', [createMessage('replacement')])
      fixture.detectChanges()

      expect(scrollContainer.scrollTop).toBe(100)
      expect(component.unreadCount).toBe(0)
    })

    it('should scroll after a message is appended while at the bottom', () => {
      setScrollDimensions(scrollContainer, { scrollHeight: 800, scrollTop: 500, clientHeight: 300 })
      scrollService.checkPosition()

      fixture.componentRef.setInput('chatMessages', [createMessage('1'), createMessage('2')])
      fixture.detectChanges()

      expect(scrollContainer.scrollTop).toBe(800)
    })

    it('should preserve position and show the unread indicator when a message arrives while scrolled up', () => {
      setScrollDimensions(scrollContainer, { scrollHeight: 800, scrollTop: 100, clientHeight: 300 })
      scrollService.checkPosition()

      fixture.componentRef.setInput('chatMessages', [createMessage('1'), createMessage('2')])
      fixture.detectChanges()

      expect(scrollContainer.scrollTop).toBe(100)
      expect((component as any).unreadCount).toBe(1)
      expect(fixture.nativeElement.querySelector('app-new-message-indicator')).not.toBeNull()
    })

    it('should scroll and clear unread messages when the indicator is clicked', () => {
      setScrollDimensions(scrollContainer, { scrollHeight: 800, scrollTop: 100, clientHeight: 300 })
      scrollService.checkPosition()
      fixture.componentRef.setInput('chatMessages', [createMessage('1'), createMessage('2')])
      fixture.detectChanges()

      const indicator: HTMLButtonElement = fixture.nativeElement.querySelector('app-new-message-indicator button')
      indicator.click()
      fixture.detectChanges()

      expect(scrollContainer.scrollTop).toBe(800)
      expect((component as any).unreadCount).toBe(0)
      expect(fixture.nativeElement.querySelector('app-new-message-indicator')).toBeNull()
    })

    it('should reset unread messages and scroll when the chat changes', () => {
      setScrollDimensions(scrollContainer, { scrollHeight: 800, scrollTop: 100, clientHeight: 300 })
      scrollService.checkPosition()
      fixture.componentRef.setInput('chatMessages', [createMessage('1'), createMessage('2')])
      fixture.detectChanges()

      fixture.componentRef.setInput('chatId', 'chat-2')
      fixture.componentRef.setInput('chatMessages', [createMessage('3')])
      fixture.detectChanges()

      expect(scrollContainer.scrollTop).toBe(800)
      expect((component as any).unreadCount).toBe(0)
    })

    it('should clear unread messages when the user manually returns to the bottom', () => {
      setScrollDimensions(scrollContainer, { scrollHeight: 800, scrollTop: 100, clientHeight: 300 })
      scrollService.checkPosition()
      fixture.componentRef.setInput('chatMessages', [createMessage('1'), createMessage('2')])
      fixture.detectChanges()

      setScrollDimensions(scrollContainer, { scrollHeight: 800, scrollTop: 500, clientHeight: 300 })
      scrollContainer.dispatchEvent(new Event('scroll'))
      fixture.detectChanges()

      expect((component as any).unreadCount).toBe(0)
      expect(fixture.nativeElement.querySelector('app-new-message-indicator')).toBeNull()
    })
  })
})
