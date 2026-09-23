import { DatePipe, NgTemplateOutlet } from '@angular/common'
import {
  AfterViewChecked,
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  ViewChild
} from '@angular/core'
import { takeUntilDestroyed } from '@angular/core/rxjs-interop'
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms'
import { TranslateModule, TranslateService } from '@ngx-translate/core'

import { AvatarModule } from 'primeng/avatar'
import { ButtonModule } from 'primeng/button'
import { CardModule } from 'primeng/card'
import { InputTextModule } from 'primeng/inputtext'
import { ProgressBarModule } from 'primeng/progressbar'
import { SelectModule } from 'primeng/select'
import { TextareaModule } from 'primeng/textarea'

import { ChatAgent } from 'src/app/chat/pages/chat-assistant/chat-assistant.state'
import { ChatMessage } from './chat.viewmodel'
import { TooltipModule } from 'primeng/tooltip'
import { MarkdownPipe } from '../../pipes/markdown.pipe'
import { FloatLabelModule } from 'primeng/floatlabel'
import { NewMessageIndicatorComponent } from '../new-message-indicator/new-message-indicator.component'
import { ChatScrollService } from '../../services/chat-scroll.service'

@Component({
  selector: 'app-chat',
  imports: [
    AvatarModule,
    ButtonModule,
    CardModule,
    DatePipe,
    InputTextModule,
    FloatLabelModule,
    SelectModule,
    ReactiveFormsModule,
    FormsModule,
    TextareaModule,
    TranslateModule,
    ProgressBarModule,
    TooltipModule,
    MarkdownPipe,
    NgTemplateOutlet,
    NewMessageIndicatorComponent
  ],
  providers: [ChatScrollService],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './chat.component.html',
  styleUrl: './chat.component.scss'
})
export class ChatComponent implements AfterViewInit, AfterViewChecked, OnChanges {
  @Input()
  chatId: string | undefined

  @Input()
  chatMessages: ChatMessage[] = []

  @Input()
  sendMessageDisabled = false

  @Input()
  agents: ChatAgent[] = []

  @Input()
  selectedAgentId: string | undefined

  @Input()
  showAgentSelector = false

  @Output()
  sendMessage = new EventEmitter<string>()

  @Output()
  retrySendMessage = new EventEmitter<string>()

  @Output()
  agentSelected = new EventEmitter<string>()

  @ViewChild('scrollContainer') private readonly scrollContainer: ElementRef | undefined

  public formGroup: FormGroup
  public isAtBottom = true
  public unreadCount = 0
  private scrollAfterRender = false

  constructor(
    private readonly translateService: TranslateService,
    private readonly chatScrollService: ChatScrollService,
    private readonly changeDetectorRef: ChangeDetectorRef
  ) {
    this.formGroup = new FormGroup({
      message: new FormControl(null, [Validators.minLength(1), Validators.maxLength(255), Validators.required])
    })

    this.chatScrollService.isAtBottom$.pipe(takeUntilDestroyed()).subscribe((isAtBottom) => {
      this.isAtBottom = isAtBottom
      if (isAtBottom) {
        this.unreadCount = 0
      }
      this.changeDetectorRef.markForCheck()
    })
  }

  ngOnChanges(changes: SimpleChanges): void {
    const chatIdChange = changes['chatId']
    if (chatIdChange && chatIdChange.previousValue !== chatIdChange.currentValue) {
      this.unreadCount = 0
      this.scrollAfterRender = true
      return
    }

    const messagesChange = changes['chatMessages']
    if (!messagesChange) return

    if (messagesChange.firstChange) {
      this.scrollAfterRender = true
      return
    }

    const previousMessages = messagesChange.previousValue as ChatMessage[]
    const currentMessages = messagesChange.currentValue as ChatMessage[]
    const addedMessageCount = Math.max(currentMessages.length - previousMessages.length, 0)
    if (addedMessageCount === 0) return

    if (this.isAtBottom) {
      this.scrollAfterRender = true
    } else {
      this.unreadCount += addedMessageCount
      this.changeDetectorRef.markForCheck()
    }
  }

  ngAfterViewInit(): void {
    if (this.scrollContainer) {
      this.chatScrollService.init(this.scrollContainer.nativeElement)
    }
  }

  ngAfterViewChecked(): void {
    if (!this.scrollAfterRender) return

    this.scrollAfterRender = false
    this.scrollToLatest()
  }

  get agentsForDropdown() {
    return this.agents.map((a) => ({
      id: a.id,
      labelKey: a.labelKey
    }))
  }

  sendButtonClicked() {
    if (this.sendMessageDisabled) return
    if (!this.formGroup.value['message'] || this.formGroup.value['message'] === '') return
    this.sendMessage.emit(this.formGroup.value['message'])
    this.formGroup.reset()
  }

  retrySending(msg: ChatMessage) {
    this.retrySendMessage.emit(msg.text)
  }

  scrollToLatest(): void {
    this.unreadCount = 0
    this.chatScrollService.scrollToBottom()
    this.chatScrollService.resetToBottom()
    this.changeDetectorRef.markForCheck()
  }
}
