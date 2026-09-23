import { ChatMessage } from 'src/app/shared/components/chat/chat.viewmodel'
import { ChatType, MessageType } from 'src/app/shared/generated'
import * as fromSelectors from './chat-assistant.selectors'
import { CHAT_AGENTS, ChatAssistantState, DEFAULT_AGENT_ID } from './chat-assistant.state'
import { ChatAssistantViewModel } from './chat-assistant.viewmodel'

describe('ChatAssistant Selectors', () => {
  const mockChats = [
    { id: '1', topic: 'Test Chat 1', type: ChatType.AiChat },
    { id: '2', topic: 'Test Chat 2', type: ChatType.HumanDirectChat }
  ]

  const mockMessages = [
    {
      id: 'msg1',
      text: 'Hello AI',
      userName: 'User1',
      type: MessageType.Human,
      creationDate: '2023-01-01T10:00:00Z'
    },
    {
      id: 'msg2',
      text: 'Hello Human',
      userName: 'AI Assistant',
      type: MessageType.Assistant,
      creationDate: '2023-01-01T10:01:00Z'
    }
  ]

  const mockCurrentChat = {
    id: 'current-chat',
    topic: 'Current Chat',
    type: ChatType.AiChat
  }

  const baseMockState: ChatAssistantState = {
    chatInitialized: false,
    user: undefined,
    chats: [],
    currentChat: undefined,
    currentMessages: undefined,
    selectedChatMode: ChatType.AiChat,
    searchQuery: '',
    totalAvailableChats: 0,
    settingsOpen: false,
    loadedChatPages: 0,
    agents: CHAT_AGENTS,
    selectedAgentId: DEFAULT_AGENT_ID,
    awaitingAssistantResponse: false
  }

  describe('chatAssistantSelectors', () => {
    it('should exist and be defined', () => {
      expect(fromSelectors.chatAssistantSelectors).toBeDefined()
    })

    it('should have child selectors created from chatFeature', () => {
      expect(fromSelectors.chatAssistantSelectors.selectUser).toBeDefined()
      expect(fromSelectors.chatAssistantSelectors.selectChats).toBeDefined()
      expect(fromSelectors.chatAssistantSelectors.selectCurrentChat).toBeDefined()
      expect(fromSelectors.chatAssistantSelectors.selectCurrentMessages).toBeDefined()
      expect(fromSelectors.chatAssistantSelectors.selectSelectedChatMode).toBeDefined()
    })
  })

  describe('selectChatAssistantViewModel', () => {
    it('should use currentChat.topic as chatTitleKey when topic is set', () => {
      const result = fromSelectors.selectChatAssistantViewModel.projector(
        mockChats,
        mockCurrentChat,
        mockMessages,
        baseMockState,
        fromSelectors.selectChatTopic.projector(mockCurrentChat, baseMockState)
      )

      const expected: ChatAssistantViewModel = {
        chats: mockChats,
        currentChat: mockCurrentChat,
        currentMessages: [
          {
            id: 'msg1',
            text: 'Hello AI',
            userNameKey: 'CHAT.PARTICIPANT.HUMAN',
            creationDate: new Date('2023-01-01T10:00:00Z'),
            type: MessageType.Human
          },
          {
            id: 'msg2',
            text: 'Hello Human',
            userNameKey: 'CHAT.PARTICIPANT.ASSISTANT',
            creationDate: new Date('2023-01-01T10:01:00Z'),
            type: MessageType.Assistant
          }
        ] as ChatMessage[],
        chatTitleKey: 'Current Chat',
        selectedChatMode: ChatType.AiChat,
        settingsOpen: false,
        agents: CHAT_AGENTS,
        selectedAgentId: DEFAULT_AGENT_ID,
        showAgentSelector: true,
        sendMessageDisabled: false
      }

      expect(result).toEqual(expected)
    })

    it('should select the chat assistant view model with direct chat mode', () => {
      const mockState = {
        ...baseMockState,
        selectedChatMode: ChatType.HumanDirectChat
      }

      const result = fromSelectors.selectChatAssistantViewModel.projector(
        mockChats,
        undefined,
        mockMessages,
        mockState,
        fromSelectors.selectChatTopic.projector(undefined, mockState)
      )

      expect(result.chatTitleKey).toBe('CHAT.TITLE.DIRECT')
    })

    it('should select the chat assistant view model with group chat mode', () => {
      const mockState = {
        ...baseMockState,
        selectedChatMode: ChatType.HumanGroupChat
      }

      const result = fromSelectors.selectChatAssistantViewModel.projector(
        mockChats,
        undefined,
        mockMessages,
        mockState,
        fromSelectors.selectChatTopic.projector(undefined, mockState)
      )

      expect(result.chatTitleKey).toBe('CHAT.TITLE.GROUP')
    })

    it('should use default title key for unknown chat mode', () => {
      const mockState = {
        ...baseMockState,
        selectedChatMode: null
      }

      const result = fromSelectors.selectChatAssistantViewModel.projector(
        mockChats,
        undefined,
        mockMessages,
        mockState,
        fromSelectors.selectChatTopic.projector(undefined, mockState)
      )

      expect(result.chatTitleKey).toBe('CHAT.TITLE.DEFAULT')
    })

    it('should use default title key for unknown currentChat.type when topic is empty', () => {
      const unknownTypeChat = { id: 'unknown', topic: '', type: 'SOME_UNKNOWN_TYPE' as any }

      const result = fromSelectors.selectChatAssistantViewModel.projector(
        mockChats,
        unknownTypeChat,
        mockMessages,
        baseMockState,
        fromSelectors.selectChatTopic.projector(unknownTypeChat, baseMockState)
      )

      expect(result.chatTitleKey).toBe('CHAT.TITLE.DEFAULT')
    })

    it('should select selectedChatMode', () => {
      const result = fromSelectors.selectChatAssistantViewModel.projector(
        mockChats,
        undefined,
        mockMessages,
        baseMockState,
        fromSelectors.selectChatTopic.projector(undefined, baseMockState)
      )

      expect(result.selectedChatMode).toEqual(ChatType.AiChat)
    })

    it('should handle undefined currentMessages', () => {
      const result = fromSelectors.selectChatAssistantViewModel.projector(
        mockChats,
        mockCurrentChat,
        undefined,
        baseMockState,
        fromSelectors.selectChatTopic.projector(mockCurrentChat, baseMockState)
      )

      expect(result.currentMessages).toBeUndefined()
    })

    it('should handle empty currentMessages array', () => {
      const result = fromSelectors.selectChatAssistantViewModel.projector(
        mockChats,
        mockCurrentChat,
        [],
        baseMockState,
        fromSelectors.selectChatTopic.projector(mockCurrentChat, baseMockState)
      )

      expect(result.currentMessages).toEqual([])
    })

    it('should handle messages with missing optional fields', () => {
      const messagesWithMissingFields = [
        {
          type: MessageType.Human
        },
        {
          id: 'msg2',
          text: 'Complete message',
          userName: 'User',
          type: MessageType.Assistant,
          creationDate: '2023-01-01T10:00:00Z'
        }
      ]

      const result = fromSelectors.selectChatAssistantViewModel.projector(
        mockChats,
        mockCurrentChat,
        messagesWithMissingFields,
        baseMockState,
        fromSelectors.selectChatTopic.projector(mockCurrentChat, baseMockState)
      )

      expect(result.currentMessages).toHaveLength(2)

      expect(result.currentMessages?.[0]).toEqual({
        id: '',
        text: '',
        userNameKey: 'CHAT.PARTICIPANT.HUMAN',
        creationDate: expect.any(Date),
        type: MessageType.Human
      })

      expect(isNaN(result.currentMessages?.[0].creationDate.getTime() ?? 0)).toBe(true)

      expect(result.currentMessages?.[1]).toEqual({
        id: 'msg2',
        text: 'Complete message',
        userNameKey: 'CHAT.PARTICIPANT.ASSISTANT',
        creationDate: new Date('2023-01-01T10:00:00Z'),
        type: MessageType.Assistant
      })
    })

    it('should sort messages by creation date', () => {
      const unsortedMessages = [
        {
          id: 'msg3',
          text: 'Third message',
          type: MessageType.Human,
          creationDate: '2023-01-01T10:02:00Z'
        },
        {
          id: 'msg1',
          text: 'First message',
          type: MessageType.Human,
          creationDate: '2023-01-01T10:00:00Z'
        },
        {
          id: 'msg2',
          text: 'Second message',
          type: MessageType.Assistant,
          creationDate: '2023-01-01T10:01:00Z'
        }
      ]

      const result = fromSelectors.selectChatAssistantViewModel.projector(
        mockChats,
        mockCurrentChat,
        unsortedMessages,
        baseMockState,
        fromSelectors.selectChatTopic.projector(mockCurrentChat, baseMockState)
      )

      expect(result.currentMessages?.[0].id).toBe('msg1')
      expect(result.currentMessages?.[1].id).toBe('msg2')
      expect(result.currentMessages?.[2].id).toBe('msg3')
    })

    it('should contain chats array', () => {
      const result = fromSelectors.selectChatAssistantViewModel.projector(
        mockChats,
        mockCurrentChat,
        mockMessages,
        baseMockState,
        fromSelectors.selectChatTopic.projector(mockCurrentChat, baseMockState)
      )

      expect(result.chats).toEqual(mockChats)
    })

    it('should handle null selectedChatMode', () => {
      const mockState = {
        ...baseMockState,
        selectedChatMode: null
      }

      const result = fromSelectors.selectChatAssistantViewModel.projector(
        mockChats,
        undefined,
        mockMessages,
        mockState,
        fromSelectors.selectChatTopic.projector(undefined, mockState)
      )

      expect(result.chatTitleKey).toBe('CHAT.TITLE.DEFAULT')
    })

    it('should transform message type to uppercase for userNameKey', () => {
      const messageWithLowercaseType = [
        {
          id: 'test',
          text: 'test message',
          userName: 'testUser',
          type: MessageType.Human,
          creationDate: '2023-01-01T10:00:00Z'
        }
      ]

      const result = fromSelectors.selectChatAssistantViewModel.projector(
        mockChats,
        mockCurrentChat,
        messageWithLowercaseType,
        baseMockState,
        fromSelectors.selectChatTopic.projector(mockCurrentChat, baseMockState)
      )

      expect(result.currentMessages?.[0].userNameKey).toBe('CHAT.PARTICIPANT.HUMAN')
    })

    it('should return trimmed userName when participant is found with userName (happy path)', () => {
      const chatWithParticipants = {
        ...mockCurrentChat,
        participants: [
          { type: 'USER' as any, id: 'user1', userId: 'user1', userName: '  John Doe  ' },
          { type: 'USER' as any, id: 'user2', userId: 'user2', userName: 'Jane Smith' }
        ]
      }
      const messages = [
        {
          id: 'msg1',
          text: 'message from user1',
          userId: 'user1',
          type: MessageType.Human,
          creationDate: '2023-01-01T10:00:00Z'
        },
        {
          id: 'msg2',
          text: 'message from user2',
          userId: 'user2',
          type: MessageType.Assistant,
          creationDate: '2023-01-01T10:01:00Z'
        }
      ]

      const result = fromSelectors.selectChatAssistantViewModel.projector(
        mockChats,
        chatWithParticipants,
        messages,
        baseMockState,
        fromSelectors.selectChatTopic.projector(chatWithParticipants, baseMockState)
      )

      expect(result.currentMessages?.[0].userName).toBe('John Doe')
      expect(result.currentMessages?.[1].userName).toBe('Jane Smith')
    })

    it('should set sendMessageDisabled to true when current chat is AiChat and awaitingAssistantResponse is true', () => {
      const mockState: ChatAssistantState = {
        ...baseMockState,
        awaitingAssistantResponse: true
      }

      const result = fromSelectors.selectChatAssistantViewModel.projector(
        mockChats,
        mockCurrentChat,
        mockMessages,
        mockState,
        fromSelectors.selectChatTopic.projector(mockCurrentChat, mockState)
      )

      expect(result.sendMessageDisabled).toBe(true)
    })

    it('should set sendMessageDisabled to false when current chat is AiChat and awaitingAssistantResponse is false', () => {
      const mockState: ChatAssistantState = {
        ...baseMockState,
        awaitingAssistantResponse: false
      }

      const result = fromSelectors.selectChatAssistantViewModel.projector(
        mockChats,
        mockCurrentChat,
        mockMessages,
        mockState,
        fromSelectors.selectChatTopic.projector(mockCurrentChat, mockState)
      )

      expect(result.sendMessageDisabled).toBe(false)
    })

    it('should set sendMessageDisabled to false when current chat is not AiChat even if awaitingAssistantResponse is true', () => {
      const directChat = { ...mockCurrentChat, type: ChatType.HumanDirectChat }
      const mockState: ChatAssistantState = {
        ...baseMockState,
        awaitingAssistantResponse: true
      }

      const result = fromSelectors.selectChatAssistantViewModel.projector(
        mockChats,
        directChat,
        mockMessages,
        mockState,
        fromSelectors.selectChatTopic.projector(directChat, mockState)
      )

      expect(result.sendMessageDisabled).toBe(false)
    })
  })
})
