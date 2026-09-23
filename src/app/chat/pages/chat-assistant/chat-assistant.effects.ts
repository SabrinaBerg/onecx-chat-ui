import { Injectable, OnDestroy } from '@angular/core'
import { Router } from '@angular/router'
import { Actions, createEffect, ofType } from '@ngrx/effects'
import { TranslateService } from '@ngx-translate/core'
import { concatLatestFrom } from '@ngrx/operators'
import { routerNavigatedAction } from '@ngrx/router-store'
import { Store } from '@ngrx/store'
import {
  catchError,
  combineLatestWith,
  debounceTime,
  distinctUntilChanged,
  EMPTY,
  filter,
  from,
  map,
  Observable,
  of,
  race,
  switchMap,
  take,
  timer
} from 'rxjs'

import { UserService } from '@onecx/angular-integration-interface'
import { AiContextGatherer, AiContextResponse } from '@onecx/integration-interface'

import { environment } from 'src/environments/environment'
import { ChatInternalService } from 'src/app/shared/services/chat-internal.service'
import { parseChatNotification } from 'src/app/shared/utils/notification.utils'
import {
  AgentAbstract,
  AgentFilterKeyEnum,
  AgentService,
  Chat,
  ChatsService,
  ChatType,
  ConfigurationFilterKeyEnum,
  MessageType
} from 'src/app/shared/generated'
import { ChatAssistantActions } from './chat-assistant.actions'
import { chatAssistantSelectors, selectChatTopic } from './chat-assistant.selectors'
import { ChatAgent, DEFAULT_AGENT_ID } from './chat-assistant.state'

const PAGE_SIZE = 20
const CHAT_TOPIC_LENGTH = 30
const CHAT_SEARCH_DELAY = 500
const ASSISTANT_RESPONSE_TIMEOUT_MS = 30000

const isSyncMessageProcessingEnabled = () => environment.chatMessageProcessingMode === 'sync'

const filterKeyMap: Record<AgentFilterKeyEnum, ConfigurationFilterKeyEnum> = {
  [AgentFilterKeyEnum.AppId]: ConfigurationFilterKeyEnum.AppId
}

const mapAgentToChatAgent = (agent: AgentAbstract): ChatAgent | undefined => {
  const id = agent.id ?? agent.name

  if (!id || !agent.name) {
    return undefined
  }

  return {
    id,
    labelKey: agent.name,
    agentName: agent.name,
    gatherContext: !!agent.filter?.value,
    filter: agent.filter?.value
      ? {
          key: agent.filter.key ? filterKeyMap[agent.filter.key] : ConfigurationFilterKeyEnum.AppId,
          value: agent.filter.value
        }
      : null
  }
}

const isChatAgent = (agent: ChatAgent | undefined): agent is ChatAgent => !!agent

@Injectable()
export class ChatAssistantEffects implements OnDestroy {
  private readonly defaultAiContext = async (): Promise<null> => {
    return null
  }
  private readonly aiContextGatherer = new AiContextGatherer(this.defaultAiContext)
  constructor(
    private readonly actions$: Actions,
    private readonly _remoteChatInternalService: ChatInternalService,
    private readonly _chatInternalService: ChatsService,
    private readonly agentService: AgentService,
    private readonly router: Router,
    private readonly store: Store,
    private readonly userService: UserService,
    private readonly translateService: TranslateService
  ) {}

  ngOnDestroy(): void {
    this.aiContextGatherer.destroy()
  }

  get chatInternalService() {
    return this._remoteChatInternalService.getService() ?? this._chatInternalService
  }

  loadUserProfile$ = createEffect(() => {
    return this.userService.profile$.pipe(
      filter((profile) => !!profile?.userId),
      map((profile) => {
        const user = profile.userId
        return ChatAssistantActions.userProfileLoaded({ user })
      })
    )
  })

  initChatOnNavigation$ = createEffect(() => {
    return this.actions$.pipe(
      ofType(routerNavigatedAction),
      concatLatestFrom(() => [this.store.select(chatAssistantSelectors.selectChatInitialized)]),
      filter(([action, chatInitialized]) => !chatInitialized),
      switchMap(() => {
        return of(ChatAssistantActions.chatInitialized())
      })
    )
  })

  searchQueryChanged$ = createEffect(() => {
    return this.actions$.pipe(
      ofType(ChatAssistantActions.searchQueryChanged),
      debounceTime(CHAT_SEARCH_DELAY),
      distinctUntilChanged((previous, current) => previous.query === current.query),
      map(() => ChatAssistantActions.loadChats({ reset: true }))
    )
  })

  triggerLoadChats$ = createEffect(() => {
    return this.actions$.pipe(
      ofType(
        ChatAssistantActions.chatInitialized,
        ChatAssistantActions.chatCreationSuccessful,
        ChatAssistantActions.backButtonClicked
      ),
      switchMap(() => of(ChatAssistantActions.loadChats({ reset: true })))
    )
  })

  triggerLoadAgents$ = createEffect(() => {
    return this.actions$.pipe(
      ofType(ChatAssistantActions.chatInitialized),
      map(() => ChatAssistantActions.loadAgents())
    )
  })

  loadAgents$ = createEffect(() => {
    return this.actions$.pipe(
      ofType(ChatAssistantActions.loadAgents),
      switchMap(() =>
        this.agentService
          .findAgentBySearchCriteria({
            pageNumber: 0,
            pageSize: 100
          })
          .pipe(
            map((response) => {
              const mappedAgents = (response.stream ?? []).map((agent) => {
                const mappedAgent = mapAgentToChatAgent(agent)
                return mappedAgent
              })
              const agents = mappedAgents.filter(isChatAgent)
              return ChatAssistantActions.agentsLoaded({
                agents
              })
            }),
            catchError((error) =>
              of(
                ChatAssistantActions.agentsLoadingFailed({
                  error
                })
              )
            )
          )
      )
    )
  })

  triggerLoadNextPage$ = createEffect(() => {
    return this.actions$.pipe(
      ofType(ChatAssistantActions.fetchNextChatsPage),
      switchMap(() => of(ChatAssistantActions.loadChats({ reset: false })))
    )
  })

  loadChats$ = createEffect(() => {
    return this.actions$.pipe(
      ofType(ChatAssistantActions.loadChats, ChatAssistantActions.refreshChatList),
      concatLatestFrom(() => [
        this.store.select(chatAssistantSelectors.selectChats),
        this.store.select(chatAssistantSelectors.selectTotalAvailableChats),
        this.store.select(chatAssistantSelectors.selectSearchQuery)
      ]),
      filter(
        ([action, chats, totalAvailableChats]) =>
          action.reset || totalAvailableChats == undefined || chats.length < totalAvailableChats
      ),
      switchMap(([action, chats, , searchQuery]) => {
        const pageNumber = action.reset ? 0 : Math.floor(chats.length / PAGE_SIZE)
        const append = !action.reset
        const topic = searchQuery?.trim() ? `%${searchQuery.trim()}%` : undefined
        return this.chatInternalService
          .searchChats({
            topic,
            pageNumber,
            pageSize: PAGE_SIZE
          })
          .pipe(
            map((response) => {
              return ChatAssistantActions.chatsLoaded({
                chats: response.stream ?? [],
                totalElements: response.totalElements ?? 0,
                append
              })
            }),
            catchError((error) =>
              of(
                ChatAssistantActions.chatsLoadingFailed({
                  error
                })
              )
            )
          )
      })
    )
  })

  handleChatNotifications$ = createEffect(() => {
    return this.actions$.pipe(
      ofType(ChatAssistantActions.notificationReceived),
      filter(({ notification }) => !!notification && notification.body.applicationId === 'onecx-chat'),
      combineLatestWith(this.store.select(chatAssistantSelectors.selectCurrentChat)),
      map(([{ notification }, currentChat]) => {
        const parsed = parseChatNotification(notification)
        if (parsed?.type === 'update_chat') {
          if (currentChat?.id === parsed.chatId) {
            return ChatAssistantActions.refreshCurrentChat()
          }
          return ChatAssistantActions.refreshChatList({ reset: true })
        }
        return ChatAssistantActions.chatNotificationIgnored()
      })
    )
  })

  loadAvailableMessages$ = createEffect(() => {
    return this.actions$.pipe(
      ofType(
        ChatAssistantActions.chatSelected,
        ChatAssistantActions.messageSendingSuccessful,
        ChatAssistantActions.refreshCurrentChat
      ),
      concatLatestFrom(() => [this.store.select(chatAssistantSelectors.selectCurrentChat)]),
      filter(([action, chat]) => {
        const isSendSuccessAction = action.type === ChatAssistantActions.messageSendingSuccessful.type
        return !isSendSuccessAction || isSyncMessageProcessingEnabled()
      }),
      switchMap(([, chat]) => {
        if (!chat || chat.id === 'new') {
          return EMPTY
        }

        const chatId = chat.id ?? ''
        return this.chatInternalService.getChatMessages(chatId).pipe(
          map((response) => {
            return ChatAssistantActions.messagesLoaded({
              messages: response
            })
          }),
          catchError((error) =>
            of(
              ChatAssistantActions.messagesLoadingFailed({
                error
              })
            )
          )
        )
      })
    )
  })

  deleteChat$ = createEffect(() => {
    return this.actions$.pipe(
      ofType(ChatAssistantActions.deleteChatClicked),
      filter(({ chat }) => chat?.id !== undefined && chat.id !== 'new'),
      switchMap(({ chat }) => {
        const chatId = chat.id ?? ''
        return this.chatInternalService.deleteChat(chatId).pipe(
          map(() => {
            return ChatAssistantActions.chatDeletionSuccessful({
              chatId
            })
          }),
          catchError((error) =>
            of(
              ChatAssistantActions.chatDeletionFailed({
                error
              })
            )
          )
        )
      })
    )
  })

  saveSettings$ = createEffect(() => {
    return this.actions$.pipe(
      ofType(ChatAssistantActions.saveSettingsClicked),
      concatLatestFrom(() => this.store.select(chatAssistantSelectors.selectCurrentChat)),
      filter(([, currentChat]) => currentChat !== undefined),
      switchMap(([action, currentChat]) => {
        if (!currentChat) {
          return EMPTY
        }

        const payload: Partial<Chat> = {
          ...currentChat,
          topic: action.chatName ?? currentChat.topic ?? ''
        }
        return of(ChatAssistantActions.updateCurrentChat({ chat: payload }))
      })
    )
  })

  updateCurrentChat$ = createEffect(() => {
    return this.actions$.pipe(
      ofType(ChatAssistantActions.updateCurrentChat),
      concatLatestFrom(() => [this.store.select(chatAssistantSelectors.selectCurrentChat)]),
      filter(([, chat]) => chat !== undefined),
      switchMap(([action, chat]) => {
        if (!chat || chat.id === 'new') {
          return EMPTY
        }

        const updatedChat = { ...chat, ...action.chat } as Chat
        return this.chatInternalService.updateChat(chat.id ?? '', action.chat).pipe(
          map(() => ChatAssistantActions.chatUpdateSuccessful({ chat: updatedChat })),
          catchError((error) =>
            of(
              ChatAssistantActions.chatUpdateFailed({
                error
              })
            )
          )
        )
      })
    )
  })

  createChatAndSendMessage$ = createEffect(() => {
    return this.actions$.pipe(
      ofType(ChatAssistantActions.createNewChatForMessage),
      concatLatestFrom(() => [
        this.store.select(chatAssistantSelectors.selectUser),
        this.store.select(chatAssistantSelectors.selectCurrentChat),
        this.store.select(selectChatTopic),
        this.store.select(chatAssistantSelectors.selectSelectedChatMode)
      ]),
      filter(([, user]) => user !== undefined),
      switchMap(([action, user, currentChat, chatTopic, selectedChatMode]) => {
        const messageExtract =
          action.message.length > CHAT_TOPIC_LENGTH
            ? action.message.substring(0, CHAT_TOPIC_LENGTH) + '...'
            : action.message
        const chatType = currentChat?.type ?? selectedChatMode
        return this.createChat(user as string, chatTopic, chatType as ChatType, messageExtract).pipe(
          switchMap((chat) =>
            of(
              ChatAssistantActions.chatCreationSuccessful({ chat }),
              ChatAssistantActions.messageSent({ message: action.message })
            )
          ),
          catchError((error) =>
            of(
              ChatAssistantActions.chatCreationFailed({
                error
              })
            )
          )
        )
      })
    )
  })

  createChat(userEmail: string, topic: string, chatType: ChatType = ChatType.AiChat, summary?: string) {
    return this.normalizeTopic(topic, chatType).pipe(
      switchMap((normalizedTopic) =>
        this.chatInternalService.createChat({
          type: chatType,
          topic: normalizedTopic,
          participants: [userEmail],
          summary: summary
        })
      )
    )
  }

  private normalizeTopic(topic: string, chatType: ChatType): Observable<string> {
    if (!topic?.startsWith('CHAT.')) {
      return of(topic)
    }

    return this.translateService.get(topic).pipe(map((translatedTopic) => translatedTopic || topic))
  }

  sendMessage$ = createEffect(() => {
    return this.actions$.pipe(
      ofType(ChatAssistantActions.messageSent),
      concatLatestFrom(() => [
        this.store.select(chatAssistantSelectors.selectCurrentChat),
        this.store.select(chatAssistantSelectors.selectAgents),
        this.store.select(chatAssistantSelectors.selectSelectedAgentId),
        this.store.select(chatAssistantSelectors.selectUser)
      ]),
      switchMap(([action, chat, agents, selectedAgentId, user]) => {
        const selectedAgent = (agents as ChatAgent[]).find((a) => a.id === (selectedAgentId as string))
        const gather$: Observable<(AiContextResponse | null)[]> = selectedAgent?.gatherContext
          ? from(
              this.aiContextGatherer.gather({
                agent: { name: selectedAgent.agentName }
              })
            )
          : of([])
        return gather$.pipe(
          map(
            (context) =>
              [action, chat, context, selectedAgent, selectedAgentId, user] as [
                typeof action,
                typeof chat,
                (AiContextResponse | null)[],
                ChatAgent | undefined,
                typeof selectedAgentId,
                typeof user
              ]
          )
        )
      }),
      switchMap(([action, chat, context, selectedAgent, selectedAgentId, user]) => {
        if (!chat?.id || chat.id === 'new') {
          return of(
            ChatAssistantActions.createNewChatForMessage({
              message: action.message
            })
          )
        }
        return this.chatInternalService
          .createChatMessage(chat.id, {
            type: MessageType.Human,
            text: action.message,
            awaitResponse: isSyncMessageProcessingEnabled(),
            userId: user ?? '',
            requestContext: {
              ...(selectedAgent?.filter ? { filter: selectedAgent.filter } : {}),
              agentId:
                // for default return undefined so the backend falls back to its default agent resolution
                selectedAgentId !== DEFAULT_AGENT_ID ? selectedAgentId : undefined,
              aiContext: context.filter((c): c is AiContextResponse => c !== null).map((c) => JSON.stringify(c))
            }
          })
          .pipe(
            map((message) =>
              ChatAssistantActions.messageSendingSuccessful({
                message
              })
            ),
            catchError((error) =>
              of(
                ChatAssistantActions.messageSendingFailed({
                  message: action.message,
                  error
                })
              )
            )
          )
      })
    )
  })

  awaitAssistantResponseTimeout$ = createEffect(() => {
    return this.actions$.pipe(
      ofType(ChatAssistantActions.messageSent),
      concatLatestFrom(() => [this.store.select(chatAssistantSelectors.selectCurrentChat)]),
      filter(([, chat]) => chat !== undefined && chat.type === ChatType.AiChat),
      switchMap(([action, chat]) => {
        const activeChatId = chat?.id ?? ''

        return race(
          this.actions$.pipe(
            ofType(ChatAssistantActions.messagesLoaded, ChatAssistantActions.messageSendingFailed),
            concatLatestFrom(() => [this.store.select(chatAssistantSelectors.selectCurrentChat)]),
            filter(([, currentChat]) => currentChat?.id === activeChatId),
            take(1),
            map(() => null)
          ),
          timer(ASSISTANT_RESPONSE_TIMEOUT_MS).pipe(map(() => ChatAssistantActions.awaitAssistantResponseTimedOut()))
        )
      }),
      filter((result) => result !== null)
    )
  })
}
