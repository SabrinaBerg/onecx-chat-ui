import { ChatMessage } from 'src/app/shared/components/chat/chat.viewmodel'
import { Chat, ChatType } from 'src/app/shared/generated'
import { ChatAgent } from './chat-assistant.state'

export interface ChatAssistantViewModel {
  chats: Chat[] | undefined
  currentChat: Chat | undefined
  currentMessages: ChatMessage[] | undefined
  chatTitleKey: string
  selectedChatMode: ChatType | null
  settingsOpen: boolean
  agents: ChatAgent[]
  selectedAgentId: string
  showAgentSelector: boolean
  sendMessageDisabled: boolean
}
