import { ComponentFixture, TestBed } from '@angular/core/testing'
import { NoopAnimationsModule } from '@angular/platform-browser/animations'
import { TranslateTestingModule } from 'ngx-translate-testing'
import { BehaviorSubject, ReplaySubject } from 'rxjs'

import { UserService } from '@onecx/angular-integration-interface'
import { REMOTE_COMPONENT_CONFIG, RemoteComponentConfig } from '@onecx/angular-utils'

import { ChatPanelVisibilityTopic } from 'src/app/shared/topics/chat-panel-visibility.topic'
import { OneCXChatToggleComponent } from './chat-toggle.component'

describe('OneCXChatToggleComponent', () => {
  let component: OneCXChatToggleComponent
  let fixture: ComponentFixture<OneCXChatToggleComponent>
  let rcConfig: ReplaySubject<RemoteComponentConfig>

  beforeEach(async () => {
    rcConfig = new ReplaySubject<RemoteComponentConfig>(1)

    await TestBed.configureTestingModule({
      imports: [
        OneCXChatToggleComponent,
        NoopAnimationsModule,
        TranslateTestingModule.withTranslations('en', {}).withTranslations('de', {})
      ],
      providers: [
        { provide: REMOTE_COMPONENT_CONFIG, useValue: rcConfig },
        { provide: UserService, useValue: { lang$: new BehaviorSubject<string>('en') } }
      ]
    }).compileComponents()

    fixture = TestBed.createComponent(OneCXChatToggleComponent)
    component = fixture.componentInstance
    fixture.detectChanges()
  })

  afterEach(() => jest.restoreAllMocks())

  it('should create the component', () => {
    expect(component).toBeTruthy()
  })

  it('should forward the remote component config', () => {
    const config = { productName: 'p', appId: 'a', baseUrl: '/b', permissions: [] } as RemoteComponentConfig
    const spy = jest.spyOn(rcConfig, 'next')

    component.ocxRemoteComponentConfig = config

    expect(spy).toHaveBeenCalledWith(config)
  })

  it('should publish the opposite visibility when toggled', () => {
    const publishSpy = jest.spyOn(ChatPanelVisibilityTopic.prototype, 'publish').mockResolvedValue()

    component.visible = false
    component.toggle()
    component.visible = true
    component.toggle()

    expect(publishSpy).toHaveBeenNthCalledWith(1, true)
    expect(publishSpy).toHaveBeenNthCalledWith(2, false)
  })

  it('should expose the expanded state on the button', async () => {
    const button: HTMLButtonElement = fixture.nativeElement.querySelector('button')
    expect(button.getAttribute('aria-expanded')).toBe('false')

    await new ChatPanelVisibilityTopic().publish(true)
    await fixture.whenStable()
    fixture.detectChanges()

    expect(button.getAttribute('aria-expanded')).toBe('true')
  })

  it('should follow visibility published on the topic', async () => {
    await new ChatPanelVisibilityTopic().publish(true)
    await fixture.whenStable()

    expect(component.visible).toBe(true)
  })
})
