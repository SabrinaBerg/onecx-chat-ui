import { TestBed } from '@angular/core/testing'
import { ActivatedRoute, Router } from '@angular/router'
import { Actions } from '@ngrx/effects'
import { provideMockActions } from '@ngrx/effects/testing'
import { routerNavigatedAction } from '@ngrx/router-store'
import { Store } from '@ngrx/store'
import { MockStore, provideMockStore } from '@ngrx/store/testing'
import { Observable, of, throwError } from 'rxjs'

import { PortalMessageService } from '@onecx/angular-integration-interface'
import { ExportDataService } from '@onecx/angular-accelerator'

import { Chat, ChatType, ChatsService } from 'src/app/shared/generated'
import { ChatSearchActions } from './chat-search.actions'
import { ChatSearchEffects } from './chat-search.effects'
import { ChatSearchCriteria } from './chat-search.parameters'
import { chatSearchSelectors, selectChatSearchViewModel } from './chat-search.selectors'

// Mock @onecx/ngrx-accelerator functions
jest.mock('@onecx/ngrx-accelerator', () => ({
  ...jest.requireActual('@onecx/ngrx-accelerator'),
  filterForNavigatedTo: jest.fn().mockReturnValue((source: Observable<any>) => source),
  filterOutQueryParamsHaveNotChanged: jest.fn().mockReturnValue((source: Observable<any>) => source),
  filterOutOnlyQueryParamsChanged: jest.fn().mockReturnValue((source: Observable<any>) => source)
}))

describe('ChatSearchEffects', () => {
  let actions$: Observable<any>
  let effects: ChatSearchEffects
  let store: MockStore
  let chatService: jest.Mocked<ChatsService>
  let router: jest.Mocked<Router>
  let route: jest.Mocked<ActivatedRoute>
  let messageService: jest.Mocked<PortalMessageService>
  let exportDataService: jest.Mocked<ExportDataService>

  const mockChats: Chat[] = [
    {
      id: '1',
      topic: 'Chat 1',
      type: 'AI_CHAT' as any,
      participants: []
    },
    {
      id: '2',
      topic: 'Chat 2',
      type: 'HUMAN_CHAT' as any,
      participants: []
    }
  ]

  const mockSearchCriteria: ChatSearchCriteria = {
    topic: 'test',
    type: ChatType.AiChat
  }

  const mockViewModel = {
    columns: [],
    searchCriteria: mockSearchCriteria,
    results: mockChats.map((chat) => ({
      imagePath: '',
      id: chat.id ?? '',
      ...chat
    })),
    displayedColumns: [],
    viewMode: 'basic' as const,
    chartVisible: false
  }

  beforeEach(() => {
    const chatServiceSpy = {
      searchChats: jest.fn()
    }
    const routerSpy = {
      navigate: jest.fn(),
      parseUrl: jest.fn()
    }
    const routeSpy = {
      queryParams: of({}),
      snapshot: {
        queryParams: {}
      }
    }
    const messageServiceSpy = {
      error: jest.fn()
    }
    const exportDataServiceSpy = {
      exportCsv: jest.fn()
    }

    TestBed.configureTestingModule({
      providers: [
        Actions,
        provideMockActions(() => actions$),
        provideMockStore({
          initialState: {
            chat: {
              search: {
                columns: [],
                results: [],
                displayedColumns: null,
                viewMode: 'basic',
                chartVisible: false,
                searchLoadingIndicator: false,
                criteria: {}
              }
            }
          }
        }),
        { provide: ChatsService, useValue: chatServiceSpy },
        { provide: Router, useValue: routerSpy },
        { provide: ActivatedRoute, useValue: routeSpy },
        { provide: PortalMessageService, useValue: messageServiceSpy },
        { provide: ExportDataService, useValue: exportDataServiceSpy }
      ]
    })

    const actionsInstance = TestBed.inject(Actions)
    const routeInstance = TestBed.inject(ActivatedRoute)
    const chatsService = TestBed.inject(ChatsService)
    const routerInstance = TestBed.inject(Router)
    const storeInstance = TestBed.inject(Store)
    const messageServiceInstance = TestBed.inject(PortalMessageService)
    const exportDataServiceInstance = TestBed.inject(ExportDataService)

    // Create effects instance manually
    effects = new ChatSearchEffects(
      actionsInstance,
      routeInstance,
      chatsService,
      routerInstance,
      storeInstance,
      messageServiceInstance,
      exportDataServiceInstance
    )

    store = TestBed.inject(MockStore)
    chatService = chatServiceSpy as unknown as jest.Mocked<ChatsService>
    router = routerSpy as unknown as jest.Mocked<Router>
    route = routeSpy as unknown as jest.Mocked<ActivatedRoute>
    messageService = messageServiceSpy as unknown as jest.Mocked<PortalMessageService>
    exportDataService = exportDataServiceSpy as unknown as jest.Mocked<ExportDataService>

    store.overrideSelector(chatSearchSelectors.selectCriteria, {})
    store.overrideSelector(chatSearchSelectors.selectChartVisible, false)
    store.overrideSelector(selectChatSearchViewModel, mockViewModel)
  })

  afterEach(() => {
    localStorage.clear()
  })

  describe('syncParamsToUrl$', () => {
    beforeEach(() => {
      ;(router.navigate as jest.Mock).mockClear()
    })

    it.each([
      {
        action: 'searchButtonClicked',
        createAction: () => ChatSearchActions.searchButtonClicked({ searchCriteria: mockSearchCriteria }),
        criteria: mockSearchCriteria,
        routeParams: {},
        expectedParams: mockSearchCriteria,
        shouldNavigate: true
      },
      {
        action: 'resetButtonClicked',
        createAction: () => ChatSearchActions.resetButtonClicked(),
        criteria: {},
        routeParams: { topic: 'something' },
        expectedParams: {},
        shouldNavigate: true
      },
      {
        action: 'searchButtonClicked with matching params',
        createAction: () => ChatSearchActions.searchButtonClicked({ searchCriteria: mockSearchCriteria }),
        criteria: mockSearchCriteria,
        routeParams: mockSearchCriteria,
        expectedParams: mockSearchCriteria,
        shouldNavigate: false
      }
    ])('should handle $action correctly', (testCase, done) => {
      store.overrideSelector(chatSearchSelectors.selectCriteria, testCase.criteria)
      store.refreshState()

      Object.defineProperty(route, 'queryParams', {
        value: of(testCase.routeParams),
        writable: true
      })

      actions$ = of(testCase.createAction())

      if (testCase.shouldNavigate) {
        effects.syncParamsToUrl$.subscribe(() => {
          expect(router.navigate).toHaveBeenCalledWith([], {
            relativeTo: route,
            queryParams: testCase.expectedParams,
            replaceUrl: true,
            onSameUrlNavigation: 'ignore'
          })
          done()
        })
      } else {
        effects.syncParamsToUrl$.subscribe()
        setTimeout(() => {
          expect(router.navigate).not.toHaveBeenCalled()
          done()
        }, 100)
      }
    })
  })

  describe('syncParamsToUrl$ error handling', () => {
    it('should log an error when router.navigate rejects', async () => {
      const error = new Error('navigation failed')
      const logSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined)

      store.overrideSelector(chatSearchSelectors.selectCriteria, mockSearchCriteria)
      store.refreshState()
      Object.defineProperty(route, 'queryParams', {
        value: of({}),
        writable: true
      })
      ;(router.navigate as jest.Mock).mockRejectedValueOnce(error)
      actions$ = of(ChatSearchActions.searchButtonClicked({ searchCriteria: mockSearchCriteria }))

      effects.syncParamsToUrl$.subscribe()
      await Promise.resolve()

      expect(router.navigate).toHaveBeenCalledWith([], {
        relativeTo: route,
        queryParams: mockSearchCriteria,
        replaceUrl: true,
        onSameUrlNavigation: 'ignore'
      })
      expect(logSpy).toHaveBeenCalledWith(error)
      logSpy.mockRestore()
    })
  })

  describe('searchByUrl$', () => {
    const createRouterAction = () =>
      routerNavigatedAction({
        payload: { routerState: {} as any, event: {} as any }
      })

    it.each([
      {
        scenario: 'successful search',
        mockResponse: { stream: mockChats, totalElements: mockChats.length },
        searchError: null,
        expectedAction: ChatSearchActions.chatSearchResultsReceived({
          results: mockChats,
          totalNumberOfResults: mockChats.length
        })
      },
      {
        scenario: 'search error',
        mockResponse: null,
        searchError: 'Search failed',
        expectedAction: ChatSearchActions.chatSearchResultsLoadingFailed({ error: 'Search failed' })
      },
      {
        scenario: 'undefined totalElements',
        mockResponse: { stream: mockChats, totalElements: undefined },
        searchError: null,
        expectedAction: ChatSearchActions.chatSearchResultsReceived({
          results: mockChats,
          totalNumberOfResults: 0
        })
      }
    ])('should handle $scenario', (testCase, done) => {
      if (testCase.searchError) {
        ;(chatService.searchChats as any).mockReturnValue(throwError(() => testCase.searchError))
      } else {
        ;(chatService.searchChats as any).mockReturnValue(of(testCase.mockResponse))
      }

      actions$ = of(createRouterAction())

      effects.searchByUrl$.subscribe((resultAction) => {
        expect(resultAction).toEqual(testCase.expectedAction)
        done()
      })
    })

    it('should transform Date objects to ISO strings in search criteria', (done) => {
      const dateValue = new Date('2023-01-01')
      const searchCriteriaWithDate = { topic: 'test', exampleDate: dateValue }

      store.overrideSelector(chatSearchSelectors.selectCriteria, searchCriteriaWithDate)
      ;(chatService.searchChats as any).mockReturnValue(of({ stream: mockChats, totalElements: mockChats.length }))

      actions$ = of(createRouterAction())

      effects.searchByUrl$.subscribe(() => {
        expect(chatService.searchChats).toHaveBeenCalledWith({
          topic: 'test',
          exampleDate: dateValue.toISOString()
        })
        done()
      })
    })
  })

  describe('rehydrateChartVisibility$', () => {
    const createRouterAction = () =>
      routerNavigatedAction({
        payload: { routerState: {} as any, event: {} as any }
      })

    it.each([
      { localStorageValue: 'true', expectedVisible: true },
      { localStorageValue: 'false', expectedVisible: false },
      { localStorageValue: null, expectedVisible: false }
    ])(
      'should dispatch chartVisibilityRehydrated with $expectedVisible when localStorage is $localStorageValue',
      (testCase, done) => {
        if (testCase.localStorageValue) {
          localStorage.setItem('chatChartVisibility', testCase.localStorageValue)
        }

        actions$ = of(createRouterAction())

        effects.rehydrateChartVisibility$.subscribe((resultAction) => {
          expect(resultAction).toEqual(
            ChatSearchActions.chartVisibilityRehydrated({ visible: testCase.expectedVisible })
          )
          done()
        })
      }
    )
  })

  describe('saveChartVisibility$ & exportData$', () => {
    it.each([
      { visible: true, expectedStorage: 'true' },
      { visible: false, expectedStorage: 'false' }
    ])('should save $expectedStorage to localStorage and export data when chartVisibilityToggled', (testCase, done) => {
      store.overrideSelector(chatSearchSelectors.selectChartVisible, testCase.visible)

      const action = ChatSearchActions.chartVisibilityToggled()
      actions$ = of(action)

      let effectsCompleted = 0

      effects.saveChartVisibility$.subscribe(() => {
        expect(localStorage.getItem('chatChartVisibility')).toBe(testCase.expectedStorage)
        effectsCompleted++
        if (effectsCompleted === 2) done()
      })

      effects.exportData$.subscribe(() => {
        expect(exportDataService.exportCsv).toHaveBeenCalledWith(
          mockViewModel.displayedColumns,
          mockViewModel.results,
          'Chat.csv'
        )
        effectsCompleted++
        if (effectsCompleted === 2) done()
      })
    })

    it('should log an error when exportCsv rejects', async () => {
      const error = new Error('export failed')
      const logSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined)

      store.overrideSelector(chatSearchSelectors.selectChartVisible, true)
      store.overrideSelector(selectChatSearchViewModel, mockViewModel)
      ;(exportDataService.exportCsv as jest.Mock).mockRejectedValueOnce(error)
      actions$ = of(ChatSearchActions.chartVisibilityToggled())

      effects.exportData$.subscribe()
      await Promise.resolve()

      expect(exportDataService.exportCsv).toHaveBeenCalledWith(
        mockViewModel.displayedColumns,
        mockViewModel.results,
        'Chat.csv'
      )
      expect(logSpy).toHaveBeenCalledWith(error)
      logSpy.mockRestore()
    })
  })

  describe('displayError$', () => {
    it('should display error message when chatSearchResultsLoadingFailed action is dispatched', (done) => {
      const action = ChatSearchActions.chatSearchResultsLoadingFailed({ error: 'Test error' })
      actions$ = of(action)

      effects.displayError$.subscribe(() => {
        expect(messageService.error).toHaveBeenCalledWith({
          summaryKey: 'CHAT_SEARCH.ERROR_MESSAGES.SEARCH_RESULTS_LOADING_FAILED'
        })
        done()
      })
    })
  })

  describe('performSearch method', () => {
    it.each([
      {
        scenario: 'successful search',
        searchCriteria: { topic: 'test' },
        mockResponse: { stream: mockChats, totalElements: mockChats.length },
        error: null,
        expectedAction: ChatSearchActions.chatSearchResultsReceived({
          results: mockChats,
          totalNumberOfResults: mockChats.length
        })
      },
      {
        scenario: 'service error',
        searchCriteria: { topic: 'test' },
        mockResponse: null,
        error: 'Service error',
        expectedAction: ChatSearchActions.chatSearchResultsLoadingFailed({ error: 'Service error' })
      },
      {
        scenario: 'empty criteria',
        searchCriteria: {},
        mockResponse: { stream: [], totalElements: 0 },
        error: null,
        expectedAction: ChatSearchActions.chatSearchResultsReceived({
          results: [],
          totalNumberOfResults: 0
        })
      },
      {
        scenario: 'undefined stream returns empty array',
        searchCriteria: { topic: 'test' },
        mockResponse: { stream: undefined, totalElements: 5 },
        error: null,
        expectedAction: ChatSearchActions.chatSearchResultsReceived({
          results: [],
          totalNumberOfResults: 5
        })
      }
    ])('should handle $scenario', (testCase, done) => {
      if (testCase.error) {
        ;(chatService.searchChats as any).mockReturnValue(throwError(() => testCase.error))
      } else {
        ;(chatService.searchChats as any).mockReturnValue(of(testCase.mockResponse))
      }

      effects.performSearch(testCase.searchCriteria).subscribe((action) => {
        expect(chatService.searchChats).toHaveBeenCalledWith(testCase.searchCriteria)
        expect(action).toEqual(testCase.expectedAction)
        done()
      })
    })
  })

  describe('details button clicked', () => {
    it('should navigate to chat details page with correct ID', (done) => {
      const id = '12345'
      const action = ChatSearchActions.detailsButtonClicked({ id })
      const currentUrl = '/chat-search'
      jest.mocked(router.parseUrl).mockReturnValue({
        toString: () => currentUrl,
        queryParams: {},
        fragment: null
      } as any)

      actions$ = of(action)

      effects.detailsButtonClicked$.subscribe(() => {
        expect(router.navigate).toHaveBeenCalledWith([currentUrl.toString(), 'details', id])
        done()
      })
    })

    it('should log an error when details navigation rejects', async () => {
      const error = new Error('details navigation failed')
      const logSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined)
      const id = '12345'

      jest.mocked(router.parseUrl).mockReturnValue({
        toString: () => '/chat-search',
        queryParams: {},
        fragment: null
      } as any)
      ;(router.navigate as jest.Mock).mockRejectedValueOnce(error)
      actions$ = of(ChatSearchActions.detailsButtonClicked({ id }))

      effects.detailsButtonClicked$.subscribe()
      await Promise.resolve()

      expect(router.navigate).toHaveBeenCalledWith(['/chat-search', 'details', id])
      expect(logSpy).toHaveBeenCalledWith(error)
      logSpy.mockRestore()
    })
  })

  describe('edge cases', () => {
    it('should handle localStorage unavailable', (done) => {
      const originalSetItem = localStorage.setItem
      localStorage.setItem = jest.fn().mockImplementation(() => {
        throw new Error('localStorage unavailable')
      })

      store.overrideSelector(chatSearchSelectors.selectChartVisible, true)
      actions$ = of(ChatSearchActions.chartVisibilityToggled())

      effects.saveChartVisibility$.subscribe({
        error: (err) => {
          expect(err).toBeTruthy()
          localStorage.setItem = originalSetItem
          done()
        },
        complete: () => {
          localStorage.setItem = originalSetItem
          done()
        }
      })
    })
  })
})
