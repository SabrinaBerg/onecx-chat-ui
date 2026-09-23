import { createActionGroup, emptyProps, props } from '@ngrx/store'

import { Notification } from '@onecx/integration-interface'

import { Chat, ChatType, Message } from 'src/app/shared/generated'
import { ChatAgent } from './chat-assistant.state'

export const ChatAssistantActions = createActionGroup({
  source: 'ChatAssistant',
  events: {
    'user profile loaded': props<{ user: string }>(),
    'chat initialized': emptyProps(),
    'chat panel opened': emptyProps(),
    'chat panel closed': emptyProps(),
    'Load Agents': emptyProps(),
    'Agents Loaded': props<{ agents: ChatAgent[] }>(),
    'Agents Loading Failed': props<{ error: unknown }>(),
    'chats loaded': props<{
      chats: Chat[]
      totalElements: number
      searchQuery?: string
      append?: boolean
    }>(),
    'chats loading failed': props<{
      error: string | null
    }>(),
    'message sent': props<{
      message: string
    }>(),
    'message sending successful': props<{
      message: Message
    }>(),
    'message sending failed': props<{
      message: string
      error: string | null
    }>(),
    'await assistant response timed out': emptyProps(),
    'create new chat for message': props<{
      message: string
    }>(),
    'chat creation successful': props<{
      chat: Chat
    }>(),
    'chat creation failed': props<{
      error: string | null
    }>(),
    'chat update successful': props<{
      chat: Chat
    }>(),
    'chat update failed': props<{
      error: string | null
    }>(),
    'delete chat clicked': props<{
      chat: Chat
    }>(),
    'chat deletion successful': props<{
      chatId: string
    }>(),
    'chat deletion failed': props<{
      error: string | null
    }>(),
    'chat selected': props<{
      chat: Chat
    }>(),
    'update current chat': props<{
      chat: Partial<Chat>
    }>(),
    'messages loaded': props<{
      messages: Message[]
    }>(),
    'messages loading failed': props<{
      error: string | null
    }>(),
    'chat mode selected': props<{ mode: string }>(),
    'new chat clicked': props<{ mode: ChatType; topic?: string }>(),
    'back button clicked': emptyProps(),
    'settings opened': emptyProps(),
    'settings closed': emptyProps(),
    'save settings clicked': props<{ chatName: string | undefined }>(),
    'search query changed': props<{ query: string }>(),
    'fetch next chats page': emptyProps(),
    'load chats': props<{
      reset: boolean
    }>(),
    'notification received': props<{
      notification: Notification
    }>(),
    'refresh current chat': emptyProps(),
    'refresh chat list': props<{
      reset: boolean
    }>(),
    'chat notification ignored': emptyProps(),
    'agent selected': props<{ agentId: string }>()
  }
})
