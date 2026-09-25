import { Chat, Message, ChatType, ConfigurationFilter } from 'src/app/shared/generated'

export interface ChatAssistantState {
  user: string | undefined
  chats: Chat[]
  currentChat: Chat | undefined
  currentMessages: Message[] | undefined
  selectedChatMode: ChatType | null
  chatInitialized: boolean
  searchQuery: string
  totalAvailableChats: number | undefined
  loadedChatPages: number
  settingsOpen: boolean
  agents: ChatAgent[]
  selectedAgentId: string
  voiceChatEnabled: boolean
  awaitingAssistantResponse: boolean
  isLoading: boolean
}

export interface ChatAgent {
  id: string
  labelKey: string
  agentName: string
  gatherContext: boolean
  filter: ConfigurationFilter | null
}

export const DEFAULT_AGENT_ID = 'default'

export const CHAT_AGENTS: ChatAgent[] = [
  {
    id: 'default',
    labelKey: 'CHAT.AGENTS.DEFAULT',
    agentName: 'assistant',
    gatherContext: false,
    filter: null
  }
]
