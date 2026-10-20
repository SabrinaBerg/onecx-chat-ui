import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, Inject, Input, inject } from '@angular/core'
import { takeUntilDestroyed } from '@angular/core/rxjs-interop'
import { TranslateModule, TranslateService } from '@ngx-translate/core'
import { ButtonModule } from 'primeng/button'
import { TooltipModule } from 'primeng/tooltip'
import { ReplaySubject } from 'rxjs'

import { UserService } from '@onecx/angular-integration-interface'
import { REMOTE_COMPONENT_CONFIG, RemoteComponentConfig } from '@onecx/angular-utils'
import { ocxRemoteComponent, ocxRemoteWebcomponent } from '@onecx/angular-remote-components'

import { ChatPanelVisibilityTopic } from 'src/app/shared/topics/chat-panel-visibility.topic'

@Component({
  selector: 'app-chat-toggle',
  imports: [ButtonModule, TooltipModule, TranslateModule],
  templateUrl: './chat-toggle.component.html',
  styleUrl: './chat-toggle.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OneCXChatToggleComponent implements ocxRemoteComponent, ocxRemoteWebcomponent {
  private readonly destroyRef = inject(DestroyRef)
  private readonly visibilityTopic = new ChatPanelVisibilityTopic()
  visible = false

  @Input() set ocxRemoteComponentConfig(config: RemoteComponentConfig) {
    this.ocxInitRemoteComponent(config)
  }

  constructor(
    @Inject(REMOTE_COMPONENT_CONFIG) private readonly remoteComponentConfig: ReplaySubject<RemoteComponentConfig>,
    private readonly userService: UserService,
    private readonly translateService: TranslateService,
    private readonly cdr: ChangeDetectorRef
  ) {
    this.translateService.use(this.userService.lang$.getValue())
    this.visibilityTopic.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((visible) => {
      this.visible = visible
      this.cdr.markForCheck()
    })
    this.destroyRef.onDestroy(() => this.visibilityTopic.destroy())
  }

  ocxInitRemoteComponent(config: RemoteComponentConfig): void {
    this.remoteComponentConfig.next(config)
  }

  toggle() {
    this.visibilityTopic.publish(!this.visible)
  }
}
