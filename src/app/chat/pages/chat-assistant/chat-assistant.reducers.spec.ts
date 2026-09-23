import { Chat, ChatType, MessageType } from 'src/app/shared/generated'
import { ChatAssistantActions } from './chat-assistant.actions'
import { chatAssistantReducer, initialState } from './chat-assistant.reducers'
import { CHAT_AGENTS, ChatAssistantState, DEFAULT_AGENT_ID } from './chat-assistant.state'

describe('ChatAssistant Reducer', () => {
  const mockChat = {
    id: 'chat1',
    topic: 'Test Chat',
    type: ChatType.AiChat
  }

  const mockChats = [
    { id: 'chat1', topic: 'Test Chat 1', type: ChatType.AiChat },
    { id: 'chat2', topic: 'Test Chat 2', type: ChatType.HumanDirectChat }
  ]

  const mockMessages = [
    {
      id: 'msg1',
      text: 'Hello',
      type: MessageType.Human,
      creationDate: '2023-01-01T10:00:00Z'
    },
    {
      id: 'msg2',
      text: 'Hi there',
      type: MessageType.Assistant,
      creationDate: '2023-01-01T10:01:00Z'
    }
  ]

  describe('initial state', () => {
    it('should have correct initial state', () => {
      expect(initialState).toEqual({
        chatInitialized: false,
        user: undefined,
        chats: [],
        currentChat: undefined,
        currentMessages: undefined,
        searchQuery: '',
        selectedChatMode: null,
        settingsOpen: false,
        totalAvailableChats: undefined,
        loadedChatPages: 0,
        agents: CHAT_AGENTS,
        selectedAgentId: DEFAULT_AGENT_ID,
        awaitingAssistantResponse: false
      })
    })

    it('should return initial state when no action is provided', () => {
      const result = chatAssistantReducer(undefined, { type: 'UNKNOWN' })
      expect(result).toEqual(initialState)
    })
  })

  describe('userProfileLoaded action', () => {
    it('should set user when userProfileLoaded is dispatched', () => {
      const action = ChatAssistantActions.userProfileLoaded({
        user: 'test@example.com'
      })
      const result = chatAssistantReducer(initialState, action)
      expect(result.user).toEqual('test@example.com')
    })
  })

  describe('chatInitialized action', () => {
    it('should set chatInitialized to true when chatInitialized is dispatched', () => {
      const action = ChatAssistantActions.chatInitialized()
      const result = chatAssistantReducer(initialState, action)
      expect(result.chatInitialized).toBe(true)
    })
  })

  describe('messageSent action', () => {
    it('should add human message and AI loading message for AI chats', () => {
      const stateWithAiChat: ChatAssistantState = {
        ...initialState,
        currentChat: {
          id: 'ai-chat-1',
          type: ChatType.AiChat,
          topic: 'AI Chat',
          participants: []
        }
      }

      const action = ChatAssistantActions.messageSent({
        message: 'Hello AI'
      })

      const result = chatAssistantReducer(stateWithAiChat, action)

      expect(result.currentMessages).toHaveLength(2)
      expect(result.currentMessages?.[0]).toEqual(
        expect.objectContaining({
          type: MessageType.Human,
          id: 'new',
          text: 'Hello AI'
        })
      )
      expect(result.currentMessages?.[1]).toEqual(
        expect.objectContaining({
          type: MessageType.Assistant,
          id: 'ai-temp',
          text: '',
          isLoadingInfo: true
        })
      )
    })

    it('should only add human message for human-to-human chats', () => {
      const stateWithDirectChat: ChatAssistantState = {
        ...initialState,
        currentChat: {
          id: 'direct-chat-1',
          type: ChatType.HumanDirectChat,
          topic: 'Direct Chat',
          participants: []
        }
      }

      const action = ChatAssistantActions.messageSent({
        message: 'Hello direct chat'
      })

      const result = chatAssistantReducer(stateWithDirectChat, action)

      expect(result.currentMessages).toHaveLength(1)
      expect(result.currentMessages?.[0]).toEqual(
        expect.objectContaining({
          type: MessageType.Human,
          id: 'new',
          text: 'Hello direct chat'
        })
      )
      expect(result.currentMessages?.some((m) => m.id === 'ai-temp')).toBe(false)
    })

    it('should set awaitingAssistantResponse to true when current chat type is AiChat', () => {
      const stateWithAiChat: ChatAssistantState = {
        ...initialState,
        currentChat: {
          id: 'ai-chat-2',
          type: ChatType.AiChat,
          topic: 'AI Chat',
          participants: []
        }
      }

      const action = ChatAssistantActions.messageSent({
        message: 'Hello AI'
      })

      const result = chatAssistantReducer(stateWithAiChat, action)

      expect(result.awaitingAssistantResponse).toBe(true)
    })

    it('should keep awaitingAssistantResponse false when current chat type is not AiChat', () => {
      const stateWithDirectChat: ChatAssistantState = {
        ...initialState,
        currentChat: {
          id: 'direct-chat-2',
          type: ChatType.HumanDirectChat,
          topic: 'Direct Chat',
          participants: []
        }
      }

      const action = ChatAssistantActions.messageSent({
        message: 'Hello direct chat'
      })

      const result = chatAssistantReducer(stateWithDirectChat, action)

      expect(result.awaitingAssistantResponse).toBe(false)
    })

    it('should filter out temp messages when adding new message', () => {
      const stateWithTempMessages: ChatAssistantState = {
        ...initialState,
        currentMessages: [
          {
            id: 'temp-123',
            text: 'temp message',
            type: MessageType.Human,
            creationDate: '2023-01-01T09:00:00Z'
          },
          {
            id: 'msg1',
            text: 'real message',
            type: MessageType.Assistant,
            creationDate: '2023-01-01T09:01:00Z'
          },
          {
            id: 'new',
            text: 'another temp',
            type: MessageType.Human,
            creationDate: '2023-01-01T09:02:00Z'
          }
        ]
      }

      const action = ChatAssistantActions.messageSent({
        message: 'Hello AI'
      })

      const result = chatAssistantReducer(stateWithTempMessages, action)

      expect(result.currentMessages).toHaveLength(2)
      expect(result.currentMessages?.some((m) => m.id === 'temp-123')).toBe(false)
      expect(result.currentMessages?.some((m) => m.id === 'new' && m.text === 'another temp')).toBe(false)
      expect(result.currentMessages?.some((m) => m.id === 'msg1')).toBe(true)
    })
  })

  describe('messageSendingFailed action', () => {
    it('should add failed human message when messageSendingFailed is dispatched', () => {
      const action = ChatAssistantActions.messageSendingFailed({
        message: 'Failed message',
        error: 'Network error'
      })

      const result = chatAssistantReducer(initialState, action)

      expect(result.currentMessages).toHaveLength(1)
      expect(result.currentMessages?.[0]).toEqual(
        expect.objectContaining({
          type: MessageType.Human,
          id: 'new',
          text: 'Failed message',
          isFailed: true
        })
      )
    })

    it('should filter out temp messages when adding failed message', () => {
      const stateWithTempMessages: ChatAssistantState = {
        ...initialState,
        currentMessages: [
          {
            id: 'temp-456',
            text: 'temp message',
            type: MessageType.Human,
            creationDate: '2023-01-01T09:00:00Z'
          },
          {
            id: 'msg1',
            text: 'real message',
            type: MessageType.Assistant,
            creationDate: '2023-01-01T09:01:00Z'
          }
        ]
      }

      const action = ChatAssistantActions.messageSendingFailed({
        message: 'Failed message',
        error: 'Network error'
      })

      const result = chatAssistantReducer(stateWithTempMessages, action)

      expect(result.currentMessages).toHaveLength(2)
      expect(result.currentMessages?.some((m) => m.id === 'temp-456')).toBe(false)
      expect(result.currentMessages?.some((m) => m.id === 'msg1')).toBe(true)
    })

    it('should reset awaitingAssistantResponse to false', () => {
      const stateAwaitingResponse: ChatAssistantState = {
        ...initialState,
        awaitingAssistantResponse: true
      }

      const action = ChatAssistantActions.messageSendingFailed({
        message: 'Failed message',
        error: 'Network error'
      })

      const result = chatAssistantReducer(stateAwaitingResponse, action)

      expect(result.awaitingAssistantResponse).toBe(false)
    })
  })

  describe('chatsLoaded action', () => {
    it('should set chats when chatsLoaded is dispatched', () => {
      const action = ChatAssistantActions.chatsLoaded({
        chats: mockChats,
        totalElements: 42
      })

      const result = chatAssistantReducer(initialState, action)

      expect(result).toEqual({
        ...initialState,
        chats: mockChats,
        totalAvailableChats: 42,
        loadedChatPages: 1
      })
    })

    it('should reset loadedChatPages to 1 on a non-append load', () => {
      const stateWithPages: ChatAssistantState = {
        ...initialState,
        loadedChatPages: 5
      }

      const action = ChatAssistantActions.chatsLoaded({
        chats: mockChats,
        totalElements: 42
      })

      const result = chatAssistantReducer(stateWithPages, action)

      expect(result.loadedChatPages).toBe(1)
    })

    it('should increment loadedChatPages when append is true', () => {
      const stateWithPages: ChatAssistantState = {
        ...initialState,
        chats: [{ id: 'existing', topic: 'Existing' } as any],
        loadedChatPages: 1
      }

      const action = ChatAssistantActions.chatsLoaded({
        chats: [{ id: 'n1', topic: 'Next' } as any],
        totalElements: 50,
        append: true
      })

      const result = chatAssistantReducer(stateWithPages, action)

      expect(result.loadedChatPages).toBe(2)
    })

    it('should append chats when append is true and update totalAvailableChats', () => {
      const existing = [{ id: 'existing', topic: 'Existing' } as any]
      const stateWithExisting = { ...initialState, chats: existing }

      const nextPage = [{ id: 'n1', topic: 'Next' } as any]
      const action = ChatAssistantActions.chatsLoaded({
        chats: nextPage,
        totalElements: 50,
        append: true
      })

      const result = chatAssistantReducer(stateWithExisting, action)

      expect(result.chats).toEqual([...existing, ...nextPage])
      expect(result.totalAvailableChats).toBe(50)
    })

    it('should not append chats that already exist in the list', () => {
      const existing = [{ id: 'a', topic: 'A' } as any, { id: 'b', topic: 'B' } as any]
      const stateWithExisting = { ...initialState, chats: existing }

      const nextPage = [{ id: 'b', topic: 'B' } as any, { id: 'c', topic: 'C' } as any]
      const action = ChatAssistantActions.chatsLoaded({
        chats: nextPage,
        totalElements: 50,
        append: true
      })

      const result = chatAssistantReducer(stateWithExisting, action)

      expect(result.chats).toEqual([...existing, { id: 'c', topic: 'C' }])
    })
  })

  describe('messagesLoaded action', () => {
    it('should set currentMessages when messagesLoaded is dispatched', () => {
      const action = ChatAssistantActions.messagesLoaded({
        messages: mockMessages
      })

      const result = chatAssistantReducer(initialState, action)

      expect(result).toEqual({
        ...initialState,
        currentMessages: mockMessages
      })
    })

    it('should reset awaitingAssistantResponse to false', () => {
      const stateAwaitingResponse: ChatAssistantState = {
        ...initialState,
        awaitingAssistantResponse: true
      }

      const action = ChatAssistantActions.messagesLoaded({
        messages: mockMessages
      })

      const result = chatAssistantReducer(stateAwaitingResponse, action)

      expect(result.awaitingAssistantResponse).toBe(false)
    })
  })

  describe('chatSelected and chatCreationSuccessful actions', () => {
    it('should set currentChat and clear messages when chatSelected is dispatched', () => {
      const stateWithMessages: ChatAssistantState = {
        ...initialState,
        currentMessages: mockMessages,
        settingsOpen: true
      }

      const action = ChatAssistantActions.chatSelected({
        chat: mockChat
      })

      const result = chatAssistantReducer(stateWithMessages, action)

      expect(result).toEqual({
        ...stateWithMessages,
        currentChat: mockChat,
        currentMessages: [],
        settingsOpen: false
      })
    })

    it('should set currentChat and clear messages when chatCreationSuccessful is dispatched', () => {
      const stateWithMessages: ChatAssistantState = {
        ...initialState,
        currentMessages: mockMessages,
        chats: mockChats
      }

      const action = ChatAssistantActions.chatCreationSuccessful({
        chat: mockChat
      })

      const result = chatAssistantReducer(stateWithMessages, action)

      expect(result).toEqual({
        ...stateWithMessages,
        currentChat: mockChat,
        currentMessages: []
      })
    })

    it('should set currentChat and set currentMessages to [] when currentMessages is undefined on chatCreationSuccessful', () => {
      const stateNoMessages: ChatAssistantState = {
        ...initialState,
        chats: mockChats
        // currentMessages is undefined by default
      }

      const action = ChatAssistantActions.chatCreationSuccessful({
        chat: mockChat
      })

      const result = chatAssistantReducer(stateNoMessages, action)

      expect(result).toEqual({
        ...stateNoMessages,
        currentChat: mockChat,
        currentMessages: [],
        chats: mockChats
      })
    })
  })

  describe('chatUpdateSuccessful action', () => {
    it('should update currentChat and preserve currentMessages when chatUpdateSuccessful is dispatched', () => {
      const stateWithMessages: ChatAssistantState = {
        ...initialState,
        currentChat: mockChat,
        settingsOpen: true
      }

      const updatedChat = { ...mockChat, topic: 'Updated Topic' }
      const action = ChatAssistantActions.chatUpdateSuccessful({
        chat: updatedChat
      })

      const result = chatAssistantReducer(stateWithMessages, action)

      expect(result).toEqual({
        ...stateWithMessages,
        currentChat: updatedChat
      })
    })
  })

  describe('chatDeletionSuccessful action', () => {
    it('should remove chat from chats array and clear current chat when chatDeletionSuccessful is dispatched', () => {
      const stateWithChats: ChatAssistantState = {
        ...initialState,
        chats: mockChats,
        currentChat: mockChats[0],
        currentMessages: mockMessages
      }

      const action = ChatAssistantActions.chatDeletionSuccessful({
        chatId: 'chat1'
      })

      const result = chatAssistantReducer(stateWithChats, action)

      expect(result).toEqual({
        ...stateWithChats,
        currentChat: undefined,
        chats: [mockChats[1]], // Only chat2 should remain
        currentMessages: []
      })
    })

    it('should not affect chats array when deleting non-existent chat', () => {
      const stateWithChats: ChatAssistantState = {
        ...initialState,
        chats: mockChats,
        currentMessages: mockMessages
      }

      const action = ChatAssistantActions.chatDeletionSuccessful({
        chatId: 'non-existent-chat'
      })

      const result = chatAssistantReducer(stateWithChats, action)

      expect(result).toEqual({
        ...stateWithChats,
        currentChat: undefined,
        chats: mockChats, // All chats should remain
        currentMessages: []
      })
    })

    it('should decrement totalAvailableChats when an existing chat is deleted', () => {
      const stateWithChats: ChatAssistantState = {
        ...initialState,
        chats: mockChats,
        totalAvailableChats: 42
      }

      const action = ChatAssistantActions.chatDeletionSuccessful({
        chatId: 'chat1'
      })

      const result = chatAssistantReducer(stateWithChats, action)

      expect(result.totalAvailableChats).toBe(41)
    })

    it('should not decrement totalAvailableChats when deleting a chat not in the list', () => {
      const stateWithChats: ChatAssistantState = {
        ...initialState,
        chats: mockChats,
        totalAvailableChats: 42
      }

      const action = ChatAssistantActions.chatDeletionSuccessful({
        chatId: 'non-existent-chat'
      })

      const result = chatAssistantReducer(stateWithChats, action)

      expect(result.totalAvailableChats).toBe(42)
    })

    it('should preserve loadedChatPages when a chat is deleted', () => {
      const stateWithChats: ChatAssistantState = {
        ...initialState,
        chats: mockChats,
        totalAvailableChats: 42,
        loadedChatPages: 3
      }

      const action = ChatAssistantActions.chatDeletionSuccessful({
        chatId: 'chat1'
      })

      const result = chatAssistantReducer(stateWithChats, action)

      expect(result.loadedChatPages).toBe(3)
    })
  })

  describe('newChatClicked action', () => {
    it('should set currentChat to a new chat object when newChatClicked is dispatched', () => {
      const action = ChatAssistantActions.newChatClicked({
        mode: ChatType.AiChat
      })
      const result = chatAssistantReducer(initialState, action)

      expect(result.currentChat).toEqual({
        id: 'new',
        topic: '',
        participants: [],
        type: ChatType.AiChat
      })
      expect(result.currentMessages).toEqual([])
    })

    it('should set currentChat with topic when chatName is provided', () => {
      const action = ChatAssistantActions.newChatClicked({
        mode: ChatType.HumanDirectChat,
        topic: 'My Direct Chat'
      })
      const result = chatAssistantReducer(initialState, action)

      expect(result.currentChat).toEqual({
        id: 'new',
        topic: 'My Direct Chat',
        participants: [],
        type: ChatType.HumanDirectChat
      })
      expect(result.currentMessages).toEqual([])
    })
  })

  describe('chatModeDeselected action', () => {
    it('should reset chat when backButtonClicked is dispatched', () => {
      const stateWithMode: ChatAssistantState = {
        ...initialState,
        selectedChatMode: ChatType.AiChat
      }

      const action = ChatAssistantActions.backButtonClicked()

      const result = chatAssistantReducer(stateWithMode, action)

      expect(result).toEqual({
        ...stateWithMode,
        selectedChatMode: null,
        currentChat: undefined,
        currentMessages: [],
        searchQuery: ''
      })
    })
  })

  describe('cleanTemp helper function behavior', () => {
    it('should preserve messages that are not temp when messageSent is dispatched', () => {
      const stateWithMixedMessages: ChatAssistantState = {
        ...initialState,
        currentMessages: [
          {
            id: 'real-msg-1',
            text: 'real message',
            type: MessageType.Human,
            creationDate: '2023-01-01T09:00:00Z'
          },
          {
            id: 'new',
            text: 'temp message',
            type: MessageType.Human,
            creationDate: '2023-01-01T09:01:00Z'
          },
          {
            id: 'ai-temp-123',
            text: 'ai temp message',
            type: MessageType.Assistant,
            creationDate: '2023-01-01T09:02:00Z'
          },
          {
            id: 'real-msg-2',
            text: 'another real message',
            type: MessageType.Assistant,
            creationDate: '2023-01-01T09:03:00Z'
          }
        ]
      }

      const action = ChatAssistantActions.messageSent({
        message: 'New message'
      })

      const result = chatAssistantReducer(stateWithMixedMessages, action)

      expect(result.currentMessages).toHaveLength(3)
      expect(result.currentMessages?.some((m) => m.id === 'real-msg-1')).toBe(true)
      expect(result.currentMessages?.some((m) => m.id === 'real-msg-2')).toBe(true)
      expect(result.currentMessages?.some((m) => m.id === 'new' && m.text === 'temp message')).toBe(false)
      expect(result.currentMessages?.some((m) => m.id === 'ai-temp-123')).toBe(false)
    })

    it('should keep message with undefined id (covers id?.includes optional chain) when messageSendingFailed is dispatched', () => {
      const stateWithUndefinedId: ChatAssistantState = {
        ...initialState,
        currentMessages: [
          {
            text: 'message without id',
            type: MessageType.Human,
            creationDate: '2023-01-01T09:00:00Z'
          } as any,
          {
            id: 'temp-888',
            text: 'temp message',
            type: MessageType.Assistant,
            creationDate: '2023-01-01T09:01:00Z'
          },
          {
            id: 'real-1',
            text: 'real message',
            type: MessageType.Assistant,
            creationDate: '2023-01-01T09:02:00Z'
          }
        ]
      }

      const action = ChatAssistantActions.messageSendingFailed({
        message: 'Failed message',
        error: 'Network error'
      })

      const result = chatAssistantReducer(stateWithUndefinedId, action)

      expect(result.currentMessages).toHaveLength(3)
      expect(result.currentMessages?.some((m) => m.id === 'temp-888')).toBe(false)
      expect(result.currentMessages?.some((m) => m.id === 'real-1')).toBe(true)
      expect(result.currentMessages?.some((m) => m.id === undefined)).toBe(true)
    })

    it('should handle undefined message entry (covers m?.id optional chain) when messageSent is dispatched', () => {
      const stateWithUndefinedMessage: ChatAssistantState = {
        ...initialState,
        currentMessages: [
          undefined as any,
          {
            id: 'real-2',
            text: 'real message',
            type: MessageType.Human,
            creationDate: '2023-01-01T09:02:00Z'
          }
        ]
      }

      const action = ChatAssistantActions.messageSent({
        message: 'New message'
      })

      const result = chatAssistantReducer(stateWithUndefinedMessage, action)

      expect(result.currentMessages).toHaveLength(3)
      expect(result.currentMessages?.filter((m) => m === undefined)).toHaveLength(1)
      expect(result.currentMessages?.some((m) => m?.id === 'real-2')).toBe(true)
    })
  })

  describe('mergeChat and updateChatsInList behavior (via reducer)', () => {
    it('updates the matching chat in the chats array when updateCurrentChat is dispatched', () => {
      const chats: Chat[] = [
        { id: 'c1', topic: 'Old', type: ChatType.AiChat },
        { id: 'c2', topic: 'Other', type: ChatType.AiChat }
      ]
      const state: ChatAssistantState = {
        ...initialState,
        chats,
        currentChat: chats[0]
      }

      const action = ChatAssistantActions.updateCurrentChat({
        chat: { id: 'c1', topic: 'Updated' }
      })

      const result = chatAssistantReducer(state, action)

      expect(result.chats).toEqual([
        { id: 'c1', topic: 'Updated', type: ChatType.AiChat },
        { id: 'c2', topic: 'Other', type: ChatType.AiChat }
      ])
    })

    it('does not modify chats when updated chat id does not exist in list', () => {
      const chats: Chat[] = [{ id: 'c1', topic: 'Old', type: ChatType.AiChat }]
      const state: ChatAssistantState = {
        ...initialState,
        chats,
        currentChat: { id: 'other', topic: 'Other', type: ChatType.AiChat }
      }

      const action = ChatAssistantActions.updateCurrentChat({
        chat: { id: 'other', topic: 'Updated Other' }
      })

      const result = chatAssistantReducer(state, action)

      expect(result.chats).toEqual(chats)
    })

    it('returns original chats when updatedChat.id is falsy (updatedChat?.id branch)', () => {
      const chats = [{ id: 'c1', topic: 'Old' } as any]
      const state: ChatAssistantState = {
        ...initialState,
        chats,
        currentChat: undefined
      }

      const action = ChatAssistantActions.updateCurrentChat({
        chat: undefined
      } as any)

      const result = chatAssistantReducer(state, action)

      expect(result.chats).toEqual(chats)
    })
  })

  describe('searchQueryChanged action', () => {
    it('should update searchQuery when searchQueryChanged is dispatched', () => {
      const action = ChatAssistantActions.searchQueryChanged({
        query: 'test query'
      })
      const result = chatAssistantReducer(initialState, action)

      expect(result.searchQuery).toBe('test query')
      expect(result.chats).toEqual(initialState.chats)
    })
  })

  describe('settingsOpened and settingsClosed actions', () => {
    it('should set settingsOpen to true when settingsOpened is dispatched', () => {
      const stateWithSettingsClosed: ChatAssistantState = {
        ...initialState,
        settingsOpen: false,
        currentChat: mockChat
      }

      const action = ChatAssistantActions.settingsOpened()
      const result = chatAssistantReducer(stateWithSettingsClosed, action)

      expect(result).toEqual({
        ...stateWithSettingsClosed,
        settingsOpen: true
      })
    })

    it('should set settingsOpen to false when settingsClosed is dispatched', () => {
      const stateWithSettingsOpen: ChatAssistantState = {
        ...initialState,
        settingsOpen: true,
        currentChat: mockChat,
        currentMessages: mockMessages
      }

      const action = ChatAssistantActions.settingsClosed()
      const result = chatAssistantReducer(stateWithSettingsOpen, action)

      expect(result).toEqual({
        ...stateWithSettingsOpen,
        settingsOpen: false
      })
    })
  })

  describe('agentSelected action', () => {
    it('should update selectedAgentId when agentSelected is dispatched', () => {
      const action = ChatAssistantActions.agentSelected({
        agentId: 'test-agent-id'
      })

      const result = chatAssistantReducer(initialState, action)

      expect(result).toEqual({
        ...initialState,
        selectedAgentId: 'test-agent-id'
      })
    })
  })

  describe('awaitAssistantResponseTimedOut action', () => {
    it('should reset awaitingAssistantResponse to false', () => {
      const stateAwaitingResponse: ChatAssistantState = {
        ...initialState,
        awaitingAssistantResponse: true
      }

      const action = ChatAssistantActions.awaitAssistantResponseTimedOut()

      const result = chatAssistantReducer(stateAwaitingResponse, action)

      expect(result.awaitingAssistantResponse).toBe(false)
    })
  })
})
