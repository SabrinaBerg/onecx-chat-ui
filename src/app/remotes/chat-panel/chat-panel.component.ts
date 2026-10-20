import { ChangeDetectionStrategy, Component, Inject, Input } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { TranslateModule, TranslateService } from '@ngx-translate/core'
import { TooltipModule } from 'primeng/tooltip'
import { ReplaySubject } from 'rxjs'

import { ButtonModule } from 'primeng/button'
import { RippleModule } from 'primeng/ripple'

import { AngularAuthModule } from '@onecx/angular-auth'
import { PortalMessageService, UserService } from '@onecx/angular-integration-interface'
import { AngularAcceleratorModule } from '@onecx/angular-accelerator'
import { REMOTE_COMPONENT_CONFIG, RemoteComponentConfig } from '@onecx/angular-utils'
import {
  AngularRemoteComponentsModule,
  ocxRemoteComponent,
  ocxRemoteWebcomponent,
  SLOT_SERVICE,
  SlotService
} from '@onecx/angular-remote-components'

import { ChatAssistantComponent } from 'src/app/chat/pages/chat-assistant/chat-assistant.component'
import { ChatInternalService } from 'src/app/shared/services/chat-internal.service'
import { ChatsService } from 'src/app/shared/generated'

export function slotInitializer(slotService: SlotService) {
  return () => slotService.init()
}

@Component({
  selector: 'app-chat-panel',
  imports: [
    AngularAuthModule,
    AngularRemoteComponentsModule,
    ChatAssistantComponent,
    FormsModule,
    RippleModule,
    AngularAcceleratorModule,
    TranslateModule,
    ButtonModule,
    TooltipModule
  ],
  providers: [
    {
      provide: SLOT_SERVICE,
      useExisting: SlotService
    },
    PortalMessageService,
    ChatsService
  ],
  host: {
    style: 'display: block; flex: 0 0 auto; height: 100%; min-height: 0; overflow: hidden; align-self: stretch;'
  },
  templateUrl: './chat-panel.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OneCXChatPanelComponent implements ocxRemoteComponent, ocxRemoteWebcomponent {
  permissions: string[] = []
  loading = true

  @Input() set ocxRemoteComponentConfig(config: RemoteComponentConfig) {
    this.ocxInitRemoteComponent(config)
  }

  constructor(
    @Inject(REMOTE_COMPONENT_CONFIG) private readonly remoteComponentConfig: ReplaySubject<RemoteComponentConfig>,
    private readonly chatInternal: ChatInternalService,
    private readonly userService: UserService,
    private readonly translateService: TranslateService // private readonly bookmarkApiUtils: BookmarkAPIUtilsService
  ) {
    this.translateService.use(this.userService.lang$.getValue())
  }

  ocxInitRemoteComponent(config: RemoteComponentConfig): void {
    this.remoteComponentConfig.next(config)
    this.permissions = config.permissions
    this.chatInternal.overwriteBaseURL(config.baseUrl)
  }
}
