import { createReducer, on } from '@ngrx/store'

import { Chat, ChatType, MessageType } from 'src/app/shared/generated'
import { ChatAssistantActions } from './chat-assistant.actions'
import { CHAT_AGENTS, ChatAssistantState, DEFAULT_AGENT_ID } from './chat-assistant.state'

export const initialState: ChatAssistantState = {
  user: undefined,
  chats: [],
  currentChat: undefined,
  currentMessages: undefined,
  selectedChatMode: null,
  chatInitialized: false,
  searchQuery: '',
  totalAvailableChats: undefined,
  loadedChatPages: 0,
  settingsOpen: false,
  agents: CHAT_AGENTS,
  selectedAgentId: DEFAULT_AGENT_ID,
  awaitingAssistantResponse: false
}

const cleanTemp = (m?: { id?: string }) => {
  return m?.id !== 'new' && !m?.id?.includes('temp')
}

const shouldShowLoadingMessage = (state: ChatAssistantState): boolean => {
  return state.currentChat?.type === ChatType.AiChat
}

const mergeChat = (currentChat: Chat | undefined, actionChat: Partial<Chat>): Chat => {
  return currentChat ? { ...currentChat, ...actionChat } : (actionChat as Chat)
}

const updateChatsInList = (chats: Chat[], updatedChat: Chat, actionChat: Partial<Chat>): Chat[] => {
  return updatedChat?.id ? chats.map((c) => (c.id === updatedChat.id ? mergeChat(c, actionChat) : c)) : chats
}

export const chatAssistantReducer = createReducer(
  initialState,
  on(ChatAssistantActions.userProfileLoaded, (state, action) => ({
    ...state,
    user: action.user
  })),
  on(ChatAssistantActions.chatInitialized, (state: ChatAssistantState) => {
    return {
      ...state,
      chatInitialized: true
    }
  }),
  on(ChatAssistantActions.messageSent, (state: ChatAssistantState, action) => {
    const showLoadingMessage = shouldShowLoadingMessage(state)
    return {
      ...state,
      awaitingAssistantResponse: showLoadingMessage,
      currentMessages: [
        {
          type: MessageType.Human,
          id: 'new',
          text: action.message,
          creationDate: new Date().toISOString()
        },
        ...(showLoadingMessage
          ? [
              {
                creationDate: new Date().toISOString(),
                id: 'ai-temp',
                type: MessageType.Assistant,
                text: '',
                isLoadingInfo: true
              }
            ]
          : []),
        ...(state.currentMessages?.filter(cleanTemp) ?? [])
      ]
    }
  }),
  on(ChatAssistantActions.messageSendingFailed, (state: ChatAssistantState, action) => {
    return {
      ...state,
      awaitingAssistantResponse: false,
      currentMessages: [
        {
          type: MessageType.Human,
          id: 'new',
          text: action.message,
          creationDate: new Date().toISOString(),
          isFailed: true
        },
        ...(state.currentMessages?.filter(cleanTemp) ?? [])
      ]
    }
  }),
  on(ChatAssistantActions.chatsLoaded, (state: ChatAssistantState, action) => {
    const newChats = action.append
      ? [...state.chats, ...action.chats.filter((chat) => !state.chats.some((c) => c.id === chat.id))]
      : action.chats
    return {
      ...state,
      chats: newChats,
      totalAvailableChats: action.totalElements,
      loadedChatPages: action.append ? state.loadedChatPages + 1 : 1
    }
  }),
  on(ChatAssistantActions.messagesLoaded, (state: ChatAssistantState, action) => {
    return {
      ...state,
      awaitingAssistantResponse: false,
      currentMessages: action.messages
    }
  }),
  on(ChatAssistantActions.chatSelected, (state: ChatAssistantState, action) => {
    return {
      ...state,
      awaitingAssistantResponse: false,
      currentChat: action.chat,
      currentMessages: [],
      settingsOpen: false
    }
  }),
  on(ChatAssistantActions.chatCreationSuccessful, (state: ChatAssistantState, action) => {
    return {
      ...state,
      currentChat: action.chat,
      currentMessages: []
    }
  }),
  on(ChatAssistantActions.chatUpdateSuccessful, (state: ChatAssistantState, action) => {
    return {
      ...state,
      currentChat: action.chat
    }
  }),
  on(ChatAssistantActions.chatDeletionSuccessful, (state: ChatAssistantState, action) => {
    const wasInList = state.chats.some((c) => c.id === action.chatId)

    return {
      ...state,
      currentChat: undefined,
      chats: state.chats.filter((c) => c.id !== action.chatId),
      totalAvailableChats:
        wasInList && state.totalAvailableChats != undefined
          ? Math.max(0, state.totalAvailableChats - 1)
          : state.totalAvailableChats,
      currentMessages: []
    }
  }),
  on(ChatAssistantActions.backButtonClicked, (state) => ({
    ...state,
    awaitingAssistantResponse: false,
    selectedChatMode: null,
    currentChat: undefined,
    currentMessages: [],
    searchQuery: '',
    settingsOpen: false
  })),
  on(ChatAssistantActions.settingsOpened, (state) => ({
    ...state,
    settingsOpen: true
  })),
  on(ChatAssistantActions.settingsClosed, (state) => ({
    ...state,
    settingsOpen: false
  })),
  on(ChatAssistantActions.newChatClicked, (state, action) => ({
    ...state,
    awaitingAssistantResponse: false,
    currentChat: {
      id: 'new',
      type: action.mode,
      topic: action.topic ?? '',
      participants: []
    },
    currentMessages: []
  })),
  on(ChatAssistantActions.updateCurrentChat, (state, action) => {
    const updatedChat = mergeChat(state.currentChat, action.chat)
    const updatedChats = updateChatsInList(state.chats, updatedChat, action.chat)
    return {
      ...state,
      currentChat: updatedChat,
      chats: updatedChats,
      settingsOpen: false
    }
  }),
  on(ChatAssistantActions.searchQueryChanged, (state, action) => ({
    ...state,
    searchQuery: action.query
  })),
  on(ChatAssistantActions.agentsLoaded, (state, action) => ({
    ...state,
    agents: action.agents,
    selectedAgentId: action.agents.some((agent) => agent.id === state.selectedAgentId)
      ? state.selectedAgentId
      : (action.agents[0]?.id ?? DEFAULT_AGENT_ID)
  })),
  on(ChatAssistantActions.agentSelected, (state, action) => ({
    ...state,
    selectedAgentId: action.agentId
  })),
  on(ChatAssistantActions.awaitAssistantResponseTimedOut, (state) => ({
    ...state,
    awaitingAssistantResponse: false
  }))
)
