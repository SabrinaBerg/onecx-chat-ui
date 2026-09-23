import { createSelector } from '@ngrx/store'

import { createChildSelectors } from '@onecx/ngrx-accelerator'

import { ChatMessage } from 'src/app/shared/components/chat/chat.viewmodel'
import { Chat, Message, ChatType } from 'src/app/shared/generated'
import { chatFeature } from 'src/app/chat/chat.reducers'
import { initialState } from './chat-assistant.reducers'
import { ChatAssistantViewModel } from './chat-assistant.viewmodel'

export const chatAssistantSelectors = createChildSelectors(chatFeature.selectAssistant, initialState)

export const mapChatTypeToTitleKey = (t?: ChatType | string | null) => {
  if (!t) return 'CHAT.TITLE.DEFAULT'
  const s = String(t)
  switch (s) {
    case ChatType.AiChat:
      return 'CHAT.TITLE.AI'
    case ChatType.HumanGroupChat:
      return 'CHAT.TITLE.GROUP'
    case ChatType.HumanDirectChat:
      return 'CHAT.TITLE.DIRECT'
    default:
      return 'CHAT.TITLE.DEFAULT'
  }
}

export const selectChatTopic = createSelector(
  chatAssistantSelectors.selectCurrentChat,
  chatFeature.selectAssistant,
  (currentChat, state) => {
    if (currentChat?.topic && currentChat.topic.trim().length > 0) {
      return currentChat.topic
    }
    const fallbackType = currentChat?.type ?? state.selectedChatMode
    return mapChatTypeToTitleKey(fallbackType)
  }
)

export const selectChatAssistantViewModel = createSelector(
  chatAssistantSelectors.selectChats,
  chatAssistantSelectors.selectCurrentChat,
  chatAssistantSelectors.selectCurrentMessages,
  chatFeature.selectAssistant,
  selectChatTopic,
  (
    chats: Chat[],
    currentChat: Chat | undefined,
    currentMessages: Message[] | undefined,
    state,
    chatTitleKey: string
  ): ChatAssistantViewModel => {
    return {
      chats,
      currentChat: currentChat,
      currentMessages: currentMessages
        ?.map(
          (m) =>
            ({
              ...m,
              id: m.id ?? '',
              text: m.text ?? '',
              userName: currentChat?.participants?.find((p) => p.id === m.userId)?.userName?.trim(),
              userNameKey: `CHAT.PARTICIPANT.${m.type.toUpperCase()}`,
              creationDate: new Date(m.creationDate ?? '')
            }) as ChatMessage
        )
        .sort((a, b) => a.creationDate.getTime() - b.creationDate.getTime()),
      chatTitleKey,
      selectedChatMode: state.selectedChatMode,
      settingsOpen: state.settingsOpen,
      agents: state.agents,
      selectedAgentId: state.selectedAgentId,
      showAgentSelector: currentChat?.type === ChatType.AiChat,
      sendMessageDisabled: currentChat?.type === ChatType.AiChat && state.awaitingAssistantResponse
    }
  }
)
