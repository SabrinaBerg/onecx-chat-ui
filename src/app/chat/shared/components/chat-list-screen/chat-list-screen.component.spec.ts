import { ComponentFixture, TestBed } from '@angular/core/testing'
import { By } from '@angular/platform-browser'
import { DatePipe } from '@angular/common'
import { MockStore, provideMockStore } from '@ngrx/store/testing'
import { TranslateService } from '@ngx-translate/core'
import { TranslateTestingModule } from 'ngx-translate-testing'
import { of, firstValueFrom, Observable } from 'rxjs'

import { MenuItem } from 'primeng/api'
import { ButtonModule } from 'primeng/button'
import { Scroller, ScrollerLazyLoadEvent } from 'primeng/scroller'
import { Tooltip } from 'primeng/tooltip'

import { AppStateService } from '@onecx/angular-integration-interface'

import { ChatAssistantActions } from 'src/app/chat/pages/chat-assistant/chat-assistant.actions'
import { chatAssistantSelectors, selectHasMore } from 'src/app/chat/pages/chat-assistant/chat-assistant.selectors'
import { initialState } from 'src/app/chat/pages/chat-assistant/chat-assistant.reducers'
import { ChatType } from 'src/app/shared/generated'
import { ChatListScreenComponent } from './chat-list-screen.component'
import { ChatHeaderComponent } from '../chat-header/chat-header.component'

describe('ChatListScreenComponent', () => {
  let component: ChatListScreenComponent
  let fixture: ComponentFixture<ChatListScreenComponent>

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        ChatListScreenComponent,
        ChatHeaderComponent,
        ButtonModule,
        TranslateTestingModule.withTranslations({
          en: require('./src/assets/i18n/en.json'),
          de: require('./src/assets/i18n/de.json')
        }).withDefaultLanguage('en')
      ],
      providers: [
        DatePipe,
        {
          provide: AppStateService,
          useValue: {
            currentMfe$: of({ remoteBaseUrl: 'http://localhost/workspace' })
          }
        },
        provideMockStore({
          selectors: [{ selector: chatAssistantSelectors.selectSearchQuery, value: '' }]
        })
      ]
    }).compileComponents()

    // Mock MutationObserver
    const mutationObserverMock = jest.fn(function MutationObserver(callback) {
      this.observe = jest.fn()
      this.disconnect = jest.fn()
      this.trigger = (mockedMutationsList: any) => {
        callback(mockedMutationsList, this)
      }
      return this
    })
    globalThis.MutationObserver = mutationObserverMock as any

    fixture = TestBed.createComponent(ChatListScreenComponent)
    component = fixture.componentInstance
    fixture.detectChanges()

    const translateService = TestBed.inject(TranslateService)
    translateService.use('en')
  })

  it('should create', () => {
    expect(component).toBeTruthy()
  })

  it('should emit selectMode immediately when AI Companion type is selected', () => {
    jest.spyOn(component.selectMode, 'emit')

    component.onChatModeChange(ChatType.AiChat)

    expect(component.selectMode.emit).toHaveBeenCalledWith({ mode: ChatType.AiChat })
    expect(component.isCreatingChat).toBe(false)
    expect(component.pendingMode).toBeNull()
  })

  it('should open creation settings when Direct Chat type is selected', () => {
    component.onChatModeChange(ChatType.HumanDirectChat)

    expect(component.isCreatingChat).toBe(true)
    expect(component.pendingMode).toBe(ChatType.HumanDirectChat)
  })

  it('should open creation settings when Group Chat type is selected', () => {
    component.onChatModeChange(ChatType.HumanGroupChat)

    expect(component.isCreatingChat).toBe(true)
    expect(component.pendingMode).toBe(ChatType.HumanGroupChat)
  })

  it('should emit selectMode with "close" when header close is clicked', () => {
    jest.spyOn(component.selectMode, 'emit')
    const header = fixture.debugElement.query(By.directive(ChatHeaderComponent))
    header.triggerEventHandler('closed', null)
    expect(component.selectMode.emit).toHaveBeenCalledWith({ mode: 'close' })
  })

  it('should initialize items array in ngOnInit', async () => {
    component.ngOnInit()
    const items = await firstValueFrom(component.actionItems$ as Observable<MenuItem[]>)

    expect(items).toBeDefined()
    expect(items).toHaveLength(1)
    expect(items[0].label).toBe('Delete chat')
  })

  it('should emit deleteChat when Delete context menu item is clicked', async () => {
    jest.spyOn(component.deleteChat, 'emit')
    const testChat = { id: 'chat1', topic: 'Test Chat' } as any
    component.selectedChat = testChat
    component.ngOnInit()
    const items = await firstValueFrom(component.actionItems$ as Observable<MenuItem[]>)

    component.onContextMenu(new MouseEvent('contextmenu'), testChat)
    items[0].command?.({
      originalEvent: new MouseEvent('click'),
      item: items[0]
    })

    expect(component.deleteChat.emit).toHaveBeenCalledWith(testChat)
  })

  it('should reset selectedChat on onHide', () => {
    component.selectedChat = { id: 'chat1', topic: 'Test Chat' } as any

    component.onHide()

    expect(component.selectedChat).toBeNull()
  })

  it('should display chat list when chats are provided', () => {
    fixture.componentRef.setInput('chats', [
      { id: 'chat1', topic: 'Chat 1' } as any,
      { id: 'chat2', topic: 'Chat 2' } as any
    ])
    fixture.detectChanges()

    expect(component.chats()).toHaveLength(2)
  })

  it('should emit chatSelected when a chat item is clicked', () => {
    jest.spyOn(component.chatSelected, 'emit')
    const testChat = { id: 'chat1', topic: 'Test Chat' } as any

    component.chatSelected.emit(testChat)

    expect(component.chatSelected.emit).toHaveBeenCalledWith(testChat)
  })

  it('formattedTimes$ maps modificationDate to shortTime for recent messages', async () => {
    const now = new Date()
    const iso = now.toISOString()
    fixture.componentRef.setInput('chats', [{ id: 'c1', modificationDate: iso } as any])
    fixture.detectChanges()

    const datePipe = TestBed.inject(DatePipe)
    const expected = datePipe.transform(now, 'shortTime') || ''

    const map = await firstValueFrom(component.formattedTimes$)
    expect(map[iso]).toBe(expected)
  })

  describe('formatLastMessageTime', () => {
    let datePipe: DatePipe

    beforeEach(() => {
      datePipe = TestBed.inject(DatePipe)
    })

    it('should return shortTime format for messages less than 1 day old', (done) => {
      const now = new Date()
      const oneHourAgoDate = new Date(now.getTime() - 60 * 60 * 1000)
      const oneHourAgo = oneHourAgoDate.toISOString()
      const expected = datePipe.transform(oneHourAgoDate, 'shortTime') || ''

      component.formatLastMessageTime(oneHourAgo).subscribe((result) => {
        expect(result).toBe(expected)
        done()
      })
    })

    it('should return "Yesterday" for messages from yesterday', (done) => {
      const now = new Date()
      const yesterdayDate = new Date(now.getTime() - 24 * 60 * 60 * 1000)
      const yesterday = yesterdayDate.toISOString()

      component.formatLastMessageTime(yesterday).subscribe((result) => {
        expect(result).toBe('Yesterday')
        done()
      })
    })

    it('should return day name for messages from 2-7 days ago', (done) => {
      const now = new Date()
      const threeDaysAgoDate = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000)
      const threeDaysAgo = threeDaysAgoDate.toISOString()
      const dayName = datePipe.transform(threeDaysAgoDate, 'EEEE') || ''

      component.formatLastMessageTime(threeDaysAgo).subscribe((result) => {
        expect(result).toBe(dayName)
        done()
      })
    })

    it('should return empty string when datePipe.transform returns empty for time format', (done) => {
      const now = new Date()
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000).toISOString()

      jest.spyOn(component['datePipe'], 'transform').mockReturnValue(null)
      component.formatLastMessageTime(oneHourAgo).subscribe((result) => {
        expect(result).toBe('')
        done()
      })
    })

    it('should return empty string when datePipe.transform returns empty for date format', (done) => {
      const now = new Date()
      const tenDaysAgo = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000).toISOString()

      jest.spyOn(component['datePipe'], 'transform').mockReturnValue(null)
      component.formatLastMessageTime(tenDaysAgo).subscribe((result) => {
        expect(result).toBe('')
        done()
      })
    })

    it('should return empty string when modificationDate is undefined', (done) => {
      component.formatLastMessageTime(undefined).subscribe((result) => {
        expect(result).toBe('')
        done()
      })
    })
  })

  describe('onSearchQueryChange', () => {
    it('should dispatch ChatAssistantActions.searchQueryChanged with the query', () => {
      const testQuery = 'test search'
      const store = TestBed.inject(MockStore)
      jest.spyOn(store, 'dispatch')

      component.onSearchQueryChange(testQuery)

      expect(store.dispatch).toHaveBeenCalledWith(ChatAssistantActions.searchQueryChanged({ query: testQuery }))
    })

    it('should handle empty query string', () => {
      const store = TestBed.inject(MockStore)
      jest.spyOn(store, 'dispatch')

      component.onSearchQueryChange('')

      expect(component.searchQueryValue).toBe('')
      expect(store.dispatch).toHaveBeenCalledWith(ChatAssistantActions.searchQueryChanged({ query: '' }))
    })
  })

  describe('onChatModeChange', () => {
    it('should open creation settings when mode changes', () => {
      component.onChatModeChange(ChatType.HumanDirectChat)

      expect(component.isCreatingChat).toBe(true)
      expect(component.pendingMode).toBe(ChatType.HumanDirectChat)
    })
  })

  describe('onCreateButtonClick', () => {
    it('should emit AI mode directly', () => {
      jest.spyOn(component.selectMode, 'emit')

      component.onCreateButtonClick()

      expect(component.selectMode.emit).toHaveBeenCalledWith({ mode: ChatType.AiChat })
    })

    it('should describe the create action in its accessible label and tooltip', () => {
      const createButton = fixture.debugElement.query(By.css('#chat_list_chat_type_button'))
      const tooltip = createButton.injector.get(Tooltip)

      expect(createButton.componentInstance.ariaLabel).toBe('Create New Chat')
      expect(tooltip.content).toBe('Create New Chat')
    })
  })

  describe('onBackClicked', () => {
    it('should reset all creation-related state when back is clicked', () => {
      component.isCreatingChat = true
      component.pendingMode = ChatType.AiChat

      component.onBackClicked()

      expect(component.isCreatingChat).toBe(false)
      expect(component.pendingMode).toBeNull()
    })
  })

  describe('getGreetingKey', () => {
    it.each([
      [6, 'CHAT.INITIAL.GREETING_MORNING'],
      [13, 'CHAT.INITIAL.GREETING_AFTERNOON'],
      [22, 'CHAT.INITIAL.GREETING_EVENING']
    ])('returns %s for hour %s', (hour, expectedKey) => {
      jest.spyOn(Date.prototype, 'getHours').mockReturnValue(hour)

      const key = (component as any).getGreetingKey()

      expect(key).toBe(expectedKey)
    })
  })

  const twoChats = [{ id: 'c1', topic: 'One' } as any, { id: 'c2', topic: 'Two' } as any]

  describe('onLazyLoad', () => {
    it('dispatches fetchNextChatsPage when lazy load event occurs and more chats remain', () => {
      const store = TestBed.inject(MockStore)
      store.overrideSelector(selectHasMore, true)
      const dispatchSpy = jest.spyOn(store, 'dispatch')

      const component = TestBed.createComponent(ChatListScreenComponent).componentInstance

      component.onLazyLoad({ first: 10, last: 30 } as ScrollerLazyLoadEvent)

      expect(dispatchSpy).toHaveBeenCalledWith(ChatAssistantActions.fetchNextChatsPage())
    })

    it('does not dispatch fetchNextChatsPage when all chats are already loaded', () => {
      const store = TestBed.inject(MockStore)
      store.overrideSelector(selectHasMore, false)
      const dispatchSpy = jest.spyOn(store, 'dispatch')

      const component = TestBed.createComponent(ChatListScreenComponent).componentInstance

      component.onLazyLoad({ first: 10, last: 30 } as ScrollerLazyLoadEvent)

      expect(dispatchSpy).not.toHaveBeenCalledWith(ChatAssistantActions.fetchNextChatsPage())
    })
  })

  const setAssistantState = (overrides: Partial<Record<keyof typeof initialState, any>>) => {
    TestBed.inject(MockStore).setState({
      chat: {
        assistant: {
          ...initialState,
          chats: twoChats,
          totalAvailableChats: 10,
          ...overrides
        }
      }
    })
  }

  describe('p-scroller during loading', () => {
    it('keeps the loaded items bound while isLoading is true', () => {
      setAssistantState({ isLoading: true })
      fixture.detectChanges()

      const scrollers = fixture.debugElement.queryAll(By.directive(Scroller))
      expect(scrollers.length).toBeGreaterThan(0)
      for (const scroller of scrollers) {
        expect(scroller.componentInstance.items).toEqual(twoChats)
      }
    })

    it('does not show the full-cover loader mask while isLoading is true (no blanking of the list)', () => {
      setAssistantState({ isLoading: true })
      fixture.detectChanges()

      for (const scroller of fixture.debugElement.queryAll(By.directive(Scroller))) {
        expect(scroller.query(By.css('[data-pc-section="loader"]'))).toBeNull()
      }
    })
  })

  describe('visible bottom-of-list loading indicator', () => {
    it('shows a spinner below the scroller while isLoading is true', () => {
      setAssistantState({ isLoading: true })
      fixture.detectChanges()

      const loader = fixture.debugElement.query(By.css('#chat_list_bottom_loader'))
      expect(loader).toBeTruthy()
      for (const scroller of fixture.debugElement.queryAll(By.directive(Scroller))) {
        expect(scroller.query(By.css('#chat_list_bottom_loader'))).toBeNull()
      }
    })

    it('removes the spinner once isLoading becomes false', () => {
      setAssistantState({ isLoading: false })
      fixture.detectChanges()

      const loader = fixture.debugElement.query(By.css('#chat_list_bottom_loader'))
      expect(loader).toBeNull()
    })
  })

  describe('tooltip accessibility handlers', () => {
    it('shows the tooltip on mouse-over when a tooltip element exists', () => {
      const host = document.createElement('div')
      const tooltip = document.createElement('span')
      tooltip.className = 'p-tooltip'
      host.appendChild(tooltip)
      const event = new MouseEvent('mouseover')
      host.dispatchEvent(event)

      component.onMouseOver(event)

      expect(tooltip.style.display).toBe('block')
    })

    it('shows the tooltip on focus when a tooltip element exists', () => {
      const host = document.createElement('div')
      const tooltip = document.createElement('span')
      tooltip.className = 'p-tooltip'
      host.appendChild(tooltip)
      const event = new FocusEvent('focus')
      host.dispatchEvent(event)

      component.onFocus(event)

      expect(tooltip.style.display).toBe('block')
    })

    it('does nothing when the target has no tooltip element', () => {
      const host = document.createElement('div')
      const mouseEvent = new MouseEvent('mouseover')
      host.dispatchEvent(mouseEvent)
      const focusEvent = new FocusEvent('focus')
      host.dispatchEvent(focusEvent)

      component.onMouseOver(mouseEvent)
      component.onFocus(focusEvent)

      expect(host.querySelector('.p-tooltip')).toBeNull()
    })
  })

  describe('loading announcement (a11y)', () => {
    it('announces loading via a polite live region while isLoading is true', () => {
      setAssistantState({ isLoading: true })
      fixture.detectChanges()

      // <output> has an implicit aria-live="polite" (preferred over role="status" per Sonar a11y).
      const liveRegion = fixture.debugElement.query(By.css('output'))

      expect(liveRegion).toBeTruthy()
      expect(liveRegion.nativeElement.textContent).toContain('Loading more chats')
    })

    it('removes the announcement once isLoading becomes false', () => {
      setAssistantState({ isLoading: false })
      fixture.detectChanges()

      const liveRegion = fixture.debugElement.query(By.css('output'))

      expect(liveRegion).toBeNull()
    })
  })

  describe('onSettingsCreate', () => {
    it('emits selectMode with chatName when chatName provided', () => {
      jest.spyOn(component.selectMode, 'emit')

      component.pendingMode = ChatType.AiChat
      component.isCreatingChat = true

      component.onSettingsCreate({ chatName: 'New Topic' })

      expect(component.selectMode.emit).toHaveBeenCalledWith({ mode: ChatType.AiChat, chatName: 'New Topic' })
      expect(component.pendingMode).toBeNull()
      expect(component.isCreatingChat).toBe(false)
    })

    it('emits selectMode without chatName when chatName not provided', () => {
      jest.spyOn(component.selectMode, 'emit')

      component.pendingMode = ChatType.HumanDirectChat
      component.isCreatingChat = true

      component.onSettingsCreate({})

      expect(component.selectMode.emit).toHaveBeenCalledWith({ mode: ChatType.HumanDirectChat, chatName: undefined })
      expect(component.pendingMode).toBeNull()
      expect(component.isCreatingChat).toBe(false)
    })
  })

  describe('getChatTitleKey', () => {
    it('returns the chat.topic when present and non-empty', () => {
      const chat = { id: '1', topic: 'Custom Topic', type: ChatType.AiChat } as any

      const key = component.getChatTitleKey(chat)

      expect(key).toBe('Custom Topic')
    })

    it('falls back to mapChatTypeToTitleKey when topic is empty', () => {
      const chat = { id: '2', topic: '   ', type: ChatType.HumanDirectChat } as any

      const key = component.getChatTitleKey(chat)

      expect(key).toBe('CHAT.TITLE.DIRECT')
    })
  })
})
