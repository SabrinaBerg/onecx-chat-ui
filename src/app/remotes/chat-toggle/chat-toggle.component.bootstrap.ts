import { HttpClient, provideHttpClient, withInterceptorsFromDi } from '@angular/common/http'
import { importProvidersFrom, inject, provideAppInitializer } from '@angular/core'
import { provideAnimations } from '@angular/platform-browser/animations'
import { provideRouter } from '@angular/router'
import { TranslateLoader } from '@ngx-translate/core'
import { ReplaySubject } from 'rxjs'

import { AngularAuthModule } from '@onecx/angular-auth'
import { provideTranslateServiceForRoot } from '@onecx/angular-remote-components'
import {
  createTranslateLoader,
  provideTranslationPathFromMeta,
  provideThemeConfig,
  REMOTE_COMPONENT_CONFIG,
  RemoteComponentConfig
} from '@onecx/angular-utils'
import { bootstrapRemoteComponent } from '@onecx/angular-webcomponents'
import { AngularAcceleratorModule } from '@onecx/angular-accelerator'
import { UserService } from '@onecx/angular-integration-interface'

import { environment } from 'src/environments/environment'
import { OneCXChatToggleComponent } from './chat-toggle.component'

bootstrapRemoteComponent(
  OneCXChatToggleComponent,
  'ocx-chat-toggle-component',
  environment.production,
  [
    provideHttpClient(withInterceptorsFromDi()),
    { provide: REMOTE_COMPONENT_CONFIG, useValue: new ReplaySubject<RemoteComponentConfig>(1) },
    provideThemeConfig(),
    provideTranslationPathFromMeta(import.meta.url, 'assets/i18n/'),
    provideTranslateServiceForRoot({
      isolate: true,
      loader: {
        provide: TranslateLoader,
        useFactory: createTranslateLoader,
        deps: [HttpClient]
      }
    }),
    importProvidersFrom(AngularAcceleratorModule, AngularAuthModule),
    provideAnimations(),
    provideRouter([
      {
        path: '**',
        children: []
      }
    ]),
    provideAppInitializer(() => inject(UserService).isInitialized)
  ],
  { usePortalLayoutStyles: false }
)
