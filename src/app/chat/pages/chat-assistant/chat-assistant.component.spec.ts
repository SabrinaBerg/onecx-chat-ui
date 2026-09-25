import { SimpleChanges } from '@angular/core'
import { ComponentFixture, TestBed } from '@angular/core/testing'
import { ReactiveFormsModule } from '@angular/forms'
import { LetDirective } from '@ngrx/component'
import { MockStore, provideMockStore } from '@ngrx/store/testing'
import { TranslateTestingModule } from 'ngx-translate-testing'
import { Subject } from 'rxjs'

import { NotificationService } from '@onecx/angular-integration-interface'
import { AngularAcceleratorModule } from '@onecx/angular-accelerator'

import { ChatType } from 'src/app/shared/generated'
import { ChatAssistantActions } from './chat-assistant.actions'
import { ChatAssistantComponent } from './chat-assistant.component'
import { initialState } from './chat-assistant.reducers'

describe('ChatAssistantComponent', () => {
  let component: ChatAssistantComponent
  let fixture: ComponentFixture<ChatAssistantComponent>
  let store: MockStore
  let notificationTopic: Subject<any>

  beforeEach(async () => {
    notificationTopic = new Subject<any>()

    await TestBed.configureTestingModule({
      imports: [
        ChatAssistantComponent,
        AngularAcceleratorModule,
        LetDirective,
        ReactiveFormsModule,
        TranslateTestingModule.withTranslations({
          en: require('./src/assets/i18n/en.json'),
          de: require('./src/assets/i18n/de.json')
        }).withDefaultLanguage('en')
      ],
      providers: [
        {
          provide: NotificationService,
          useValue: {
            notificationTopic
          }
        },
        provideMockStore({
          initialState: { chat: { assistant: initialState } }
        })
      ]
    }).compileComponents()

    const mutationObserverMock = jest.fn(function MutationObserver(callback) {
      this.observe = jest.fn()
      this.disconnect = jest.fn()
      this.trigger = (mockedMutationsList: any) => {
        callback(mockedMutationsList, this)
      }
      return this
    })
    global.MutationObserver = mutationObserverMock

    global.origin = ''

    fixture = TestBed.createComponent(ChatAssistantComponent)
    component = fixture.componentInstance
    store = TestBed.inject(MockStore)
    fixture.detectChanges()
  })

  it('should create', () => {
    expect(component).toBeTruthy()
  })

  it('should dispatch notificationReceived action when notification emitted', () => {
    jest.spyOn(store, 'dispatch')

    const fakeNotification = {
      body: {
        contentMeta: [
          { key: 'type', value: 'update_chat' },
          { key: 'chatId', value: '123' }
        ]
      }
    } as unknown as any

    notificationTopic.next(fakeNotification)

    expect(store.dispatch).toHaveBeenCalledWith(
      ChatAssistantActions.notificationReceived({ notification: fakeNotification })
    )
  })

  it('should set selectedChatMode and emit sidebarVisibleChange on close', () => {
    jest.spyOn(store, 'dispatch')
    const spy = jest.spyOn(component.sidebarVisibleChange, 'emit')
    const dispatchSpy = jest.spyOn(store, 'dispatch')

    component.selectChatMode({ mode: 'close' })

    expect(component._sidebarVisible).toBe(false)
    expect(dispatchSpy).toHaveBeenCalledWith(ChatAssistantActions.chatPanelClosed())
    expect(spy).toHaveBeenCalledWith(false)
    expect(store.dispatch).toHaveBeenCalledWith(ChatAssistantActions.chatPanelClosed())
  })

  describe('voice chat methods', () => {
    it('should dispatch voiceChatEnabled when voice chat starts', () => {
      jest.spyOn(store, 'dispatch')

      component.voiceChatStarted()

      expect(store.dispatch).toHaveBeenCalledWith(ChatAssistantActions.voiceChatEnabled())
    })

    it('should dispatch voiceChatDisabled when voice chat stops', () => {
      jest.spyOn(store, 'dispatch')

      component.voiceChatStopped()

      expect(store.dispatch).toHaveBeenCalledWith(ChatAssistantActions.voiceChatDisabled())
    })

    it('should dispatch the user transcript event', () => {
      jest.spyOn(store, 'dispatch')
      const event = { text: 'Hello', isFinal: false }

      component.voiceUserTranscriptReceived(event)

      expect(store.dispatch).toHaveBeenCalledWith(ChatAssistantActions.voiceUserTranscriptReceived(event))
    })

    it('should dispatch the bot transcript event', () => {
      jest.spyOn(store, 'dispatch')
      const event = { text: 'Hi there', spoken: false }

      component.voiceBotTranscriptReceived(event)

      expect(store.dispatch).toHaveBeenCalledWith(ChatAssistantActions.voiceBotTranscriptReceived(event))
    })
  })

  it('should set selectedChatMode to ai mode and dispatch newChatClicked with ai', () => {
    jest.spyOn(store, 'dispatch')

    component.selectChatMode({ mode: ChatType.AiChat })

    expect(store.dispatch).toHaveBeenCalledWith(
      ChatAssistantActions.newChatClicked({ mode: ChatType.AiChat, topic: undefined })
    )
  })

  it('should set selectedChatMode to direct mode and dispatch newChatClicked with human', () => {
    jest.spyOn(store, 'dispatch')
    component.selectChatMode({ mode: ChatType.HumanDirectChat })

    expect(store.dispatch).toHaveBeenCalledWith(
      ChatAssistantActions.newChatClicked({ mode: ChatType.HumanDirectChat, topic: undefined })
    )
  })

  describe('closeSidebar', () => {
    it('should close sidebar, emit event, dispatch action and reset selectedChatMode', () => {
      jest.spyOn(store, 'dispatch')
      jest.spyOn(component.sidebarVisibleChange, 'emit')
      component._sidebarVisible = true

      component.closeSidebar()

      expect(component._sidebarVisible).toBe(false)
      expect(component.sidebarVisibleChange.emit).toHaveBeenCalledWith(false)
      expect(store.dispatch).toHaveBeenCalledWith(ChatAssistantActions.chatPanelClosed())
    })

    it('should work when selectedChatMode is already null', () => {
      jest.spyOn(store, 'dispatch')
      jest.spyOn(component.sidebarVisibleChange, 'emit')
      component._sidebarVisible = true

      component.closeSidebar()

      expect(component._sidebarVisible).toBe(false)
      expect(component.sidebarVisibleChange.emit).toHaveBeenCalledWith(false)
      expect(store.dispatch).toHaveBeenCalledWith(ChatAssistantActions.chatPanelClosed())
    })
  })

  describe('sidebarVisible setter', () => {
    beforeEach(() => {
      jest.spyOn(store, 'dispatch')
    })

    it('should dispatch chatPanelOpened action when sidebarVisible is set to true', () => {
      component.sidebarVisible = true

      expect(store.dispatch).toHaveBeenCalledWith(ChatAssistantActions.chatPanelOpened())
      expect(component._sidebarVisible).toBe(true)
    })

    it('should not dispatch action when sidebarVisible is set to false', () => {
      component.sidebarVisible = false

      expect(store.dispatch).not.toHaveBeenCalled()
      expect(component._sidebarVisible).toBe(false)
    })
  })

  describe('delete action', () => {
    it('should dispatch deleteChatClicked action when delete command is executed', () => {
      jest.spyOn(store, 'dispatch')

      const mockViewModel = {
        chats: [],
        currentChat: { id: 'chat1', topic: 'Test Chat', type: ChatType.AiChat },
        currentMessages: [],
        chatTitleKey: 'CHAT.TITLE.AI'
      }

      store.setState({
        chat: {
          assistant: {
            ...initialState,
            currentChat: mockViewModel.currentChat
          }
        }
      })

      component.deleteChat(mockViewModel.currentChat)

      expect(store.dispatch).toHaveBeenCalledWith(
        ChatAssistantActions.deleteChatClicked({
          chat: mockViewModel.currentChat
        })
      )
    })
  })

  describe('sendMessage', () => {
    it('should dispatch messageSent action with correct message', () => {
      jest.spyOn(store, 'dispatch')
      const testMessage = 'Hello, this is a test message'

      component.sendMessage(testMessage)

      expect(store.dispatch).toHaveBeenCalledWith(
        ChatAssistantActions.messageSent({
          message: testMessage
        })
      )
    })

    it('should handle empty message', () => {
      jest.spyOn(store, 'dispatch')

      component.sendMessage('')

      expect(store.dispatch).toHaveBeenCalledWith(
        ChatAssistantActions.messageSent({
          message: ''
        })
      )
    })
  })

  describe('agentSelected', () => {
    it('should dispatch agentSelected action with correct agentId', () => {
      jest.spyOn(store, 'dispatch')

      const agentId = 'gpt-4'

      component.agentSelected(agentId)

      expect(store.dispatch).toHaveBeenCalledWith(
        ChatAssistantActions.agentSelected({
          agentId
        })
      )
    })
  })

  describe('chatSelected', () => {
    it('should dispatch chatSelected action with correct chat', () => {
      jest.spyOn(store, 'dispatch')
      const testChat = { id: 'chat1', topic: 'Test Chat', type: ChatType.AiChat }

      component.chatSelected(testChat)

      expect(store.dispatch).toHaveBeenCalledWith(
        ChatAssistantActions.chatSelected({
          chat: testChat
        })
      )
    })

    it('should handle chat with different types', () => {
      jest.spyOn(store, 'dispatch')
      const humanChat = { id: 'chat2', topic: 'Human Chat', type: ChatType.HumanDirectChat }

      component.chatSelected(humanChat)

      expect(store.dispatch).toHaveBeenCalledWith(
        ChatAssistantActions.chatSelected({
          chat: humanChat
        })
      )
    })
  })

  describe('ngOnChanges', () => {
    it('should emit sidebarVisibleChange when sidebarVisible changes', () => {
      jest.spyOn(component.sidebarVisibleChange, 'emit')

      const changes: SimpleChanges = {
        sidebarVisible: {
          currentValue: true,
          previousValue: false,
          firstChange: false,
          isFirstChange: () => false
        }
      }

      component.ngOnChanges(changes)

      expect(component.sidebarVisibleChange.emit).toHaveBeenCalledWith(true)
    })

    it('should not emit when sidebarVisible does not change', () => {
      jest.spyOn(component.sidebarVisibleChange, 'emit')

      const changes: SimpleChanges = {
        otherProperty: {
          currentValue: 'new',
          previousValue: 'old',
          firstChange: false,
          isFirstChange: () => false
        }
      }

      component.ngOnChanges(changes)

      expect(component.sidebarVisibleChange.emit).not.toHaveBeenCalled()
    })

    it('should emit with false when sidebar is closed', () => {
      jest.spyOn(component.sidebarVisibleChange, 'emit')

      const changes: SimpleChanges = {
        sidebarVisible: {
          currentValue: false,
          previousValue: true,
          firstChange: false,
          isFirstChange: () => false
        }
      }

      component.ngOnChanges(changes)

      expect(component.sidebarVisibleChange.emit).toHaveBeenCalledWith(false)
    })

    it('goBack should dispatch the correct action', () => {
      jest.spyOn(store, 'dispatch')

      component.goBack()

      expect(store.dispatch).toHaveBeenCalledWith(ChatAssistantActions.backButtonClicked())
    })
  })

  describe('settings methods', () => {
    it('openSettings should dispatch settingsOpened action', () => {
      jest.spyOn(store, 'dispatch')
      component.openSettings()
      expect(store.dispatch).toHaveBeenCalledWith(ChatAssistantActions.settingsOpened())
    })

    it('closeSettings should dispatch settingsClosed action', () => {
      jest.spyOn(store, 'dispatch')
      component.closeSettings()
      expect(store.dispatch).toHaveBeenCalledWith(ChatAssistantActions.settingsClosed())
    })

    it('onSaveSettings should dispatch saveSettingsClicked with provided chatName', () => {
      jest.spyOn(store, 'dispatch')

      component.onSaveSettings({ chatName: 'New Topic' })

      expect(store.dispatch).toHaveBeenCalledWith(ChatAssistantActions.saveSettingsClicked({ chatName: 'New Topic' }))
    })

    it('onSaveSettings should dispatch saveSettingsClicked with undefined chatName', () => {
      jest.spyOn(store, 'dispatch')

      component.onSaveSettings({ chatName: undefined })

      expect(store.dispatch).toHaveBeenCalledWith(ChatAssistantActions.saveSettingsClicked({ chatName: undefined }))
    })
  })
})
