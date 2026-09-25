import { AsyncPipe, DatePipe, NgTemplateOutlet } from '@angular/common'
import { Component, EventEmitter, input, OnInit, Output, Signal, ViewChild } from '@angular/core'
import { toObservable, toSignal } from '@angular/core/rxjs-interop'
import { FormsModule } from '@angular/forms'
import { Store } from '@ngrx/store'
import { TranslateModule, TranslateService } from '@ngx-translate/core'
import { map, Observable, of, switchMap, forkJoin } from 'rxjs'

import { MenuItem } from 'primeng/api'
import { AvatarModule } from 'primeng/avatar'
import { ButtonModule } from 'primeng/button'
import { CardModule } from 'primeng/card'
import { ContextMenu, ContextMenuModule } from 'primeng/contextmenu'
import { InputTextModule } from 'primeng/inputtext'
import { FloatLabelModule } from 'primeng/floatlabel'
import { TabsModule } from 'primeng/tabs'
import { ScrollerLazyLoadEvent, ScrollerModule } from 'primeng/scroller'
import { TooltipModule } from 'primeng/tooltip'

import { Chat, ChatType } from 'src/app/shared/generated'
import { ChatAssistantActions } from 'src/app/chat/pages/chat-assistant/chat-assistant.actions'
import {
  chatAssistantSelectors,
  mapChatTypeToTitleKey,
  selectHasMore
} from 'src/app/chat/pages/chat-assistant/chat-assistant.selectors'
import { ChatHeaderComponent } from '../chat-header/chat-header.component'
import { ChatSettingsComponent } from '../chat-settings/chat-settings.component'

@Component({
  selector: 'app-chat-list-screen',
  imports: [
    AsyncPipe,
    AvatarModule,
    ChatHeaderComponent,
    ChatSettingsComponent,
    TranslateModule,
    CardModule,
    ButtonModule,
    InputTextModule,
    FloatLabelModule,
    TabsModule,
    ContextMenuModule,
    FormsModule,
    ScrollerModule,
    TooltipModule,
    NgTemplateOutlet
  ],
  providers: [DatePipe],
  templateUrl: './chat-list-screen.component.html',
  styleUrls: ['./chat-list-screen.component.scss']
})
export class ChatListScreenComponent implements OnInit {
  protected readonly ChatType = ChatType
  @Output() selectMode = new EventEmitter<{ mode: ChatType | 'close'; chatName?: string }>()
  @Output() chatSelected = new EventEmitter<Chat>()
  @Output() deleteChat = new EventEmitter<Chat>()

  chats = input<Chat[]>([])

  @ViewChild('cm') cm!: ContextMenu
  items: MenuItem[] | undefined
  actionItems$?: Observable<MenuItem[]>
  selectedChat: Chat | null = null
  logoUrl = ''
  searchQueryValue = ''
  filteredChats$: Observable<Chat[]>
  searchQuery$: Observable<string>
  protected readonly filteredChatsSignal: Signal<Chat[]>
  protected readonly isLoading: Signal<boolean>
  protected readonly hasMore: Signal<boolean>
  isCreatingChat = false
  pendingMode: ChatType | null = null

  constructor(
    private readonly datePipe: DatePipe,
    private readonly translate: TranslateService,
    private readonly store: Store
  ) {
    this.filteredChats$ = this.store.select(chatAssistantSelectors.selectChats)
    this.searchQuery$ = this.store.select(chatAssistantSelectors.selectSearchQuery)
    this.filteredChatsSignal = toSignal(this.filteredChats$, { initialValue: [] })
    this.isLoading = toSignal(this.store.select(chatAssistantSelectors.selectIsLoading), { initialValue: false })
    this.hasMore = toSignal(this.store.select(selectHasMore), { initialValue: true })
  }

  ngOnInit() {
    this.prepareActionButtons()
  }

  private prepareActionButtons(): void {
    this.actionItems$ = this.translate.get(['CHAT.ACTIONS.DELETE']).pipe(
      map((data) => [
        {
          label: data['CHAT.ACTIONS.DELETE'],
          icon: 'pi pi-trash',
          command: () => {
            if (this.selectedChat) {
              this.deleteChat.emit(this.selectedChat)
            }
          }
        }
      ])
    )
  }

  onLazyLoad(event: ScrollerLazyLoadEvent): void {
    if (!this.hasMore()) {
      return
    }

    this.store.dispatch(ChatAssistantActions.fetchNextChatsPage())
  }

  formattedTimes$ = toObservable(this.chats).pipe(
    switchMap((chats: Chat[]) => {
      const entries = chats.map((chat) =>
        this.formatLastMessageTime(chat.modificationDate).pipe(
          map((formattedTime) => [chat.modificationDate, formattedTime] as [string, string])
        )
      )
      return forkJoin(entries)
    }),
    map((pairs: [string, string][]) => Object.fromEntries(pairs))
  )

  formatLastMessageTime(modificationDate: string | undefined): Observable<string> {
    if (!modificationDate) return of('')

    const messageDate = new Date(modificationDate)
    const diffDays = this.getDaysDifference(messageDate)

    if (diffDays < 1) {
      return of(this.datePipe.transform(messageDate, 'shortTime') || '')
    } else if (diffDays < 2) {
      return this.translate.get('CHAT.TIME.YESTERDAY')
    } else if (diffDays < 7) {
      const dayKey = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'][
        messageDate.getDay()
      ]

      return this.translate.get(`CHAT.TIME.${dayKey}`)
    }

    return of(this.datePipe.transform(messageDate, 'shortDate') || '')
  }

  onContextMenu(event: any, chat: Chat) {
    this.selectedChat = chat
    this.cm.show(event)
  }

  onHide() {
    this.selectedChat = null
  }

  onBackClicked(): void {
    this.isCreatingChat = false
    this.pendingMode = null
  }

  onChatModeChange(mode: ChatType): void {
    if (mode === ChatType.AiChat) {
      this.selectMode.emit({ mode })
      return
    }

    this.pendingMode = mode
    this.isCreatingChat = true
  }

  onCreateButtonClick(): void {
    this.selectMode.emit({ mode: ChatType.AiChat })
  }

  onSettingsCreate(value: any): void {
    if (this.pendingMode) {
      this.selectMode.emit({ mode: this.pendingMode, chatName: value.chatName })
    }
    this.pendingMode = null
    this.isCreatingChat = false
  }

  getChatTitleKey(chat: Chat): string {
    return chat.topic && chat.topic.trim().length > 0 ? chat.topic : mapChatTypeToTitleKey(chat.type)
  }

  onSearchQueryChange(query: string): void {
    this.searchQueryValue = query
    this.store.dispatch(ChatAssistantActions.searchQueryChanged({ query }))
  }

  onMouseOver(event: Event): void {
    this.showTooltip(event.target)
  }

  onFocus(event: Event): void {
    this.showTooltip(event.target)
  }

  private showTooltip(target: EventTarget | null): void {
    const tooltip = (target as HTMLElement).querySelector<HTMLElement>('.p-tooltip')
    if (tooltip) {
      tooltip.style.display = 'block'
    }
  }

  protected getGreetingKey(): string {
    const hour = new Date().getHours()

    if (hour >= 5 && hour < 12) {
      return 'CHAT.INITIAL.GREETING_MORNING'
    } else if (hour >= 12 && hour < 18) {
      return 'CHAT.INITIAL.GREETING_AFTERNOON'
    } else {
      return 'CHAT.INITIAL.GREETING_EVENING'
    }
  }

  private getDaysDifference(date: Date): number {
    const now = new Date()
    return (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24)
  }
}
