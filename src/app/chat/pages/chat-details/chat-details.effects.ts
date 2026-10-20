import { Injectable } from '@angular/core'
import { Router } from '@angular/router'
import { Actions, createEffect, ofType } from '@ngrx/effects'
import { concatLatestFrom } from '@ngrx/operators'
import { routerNavigatedAction } from '@ngrx/router-store'
import { Action, Store } from '@ngrx/store'
import { catchError, filter, map, mergeMap, of, switchMap, tap } from 'rxjs'

import { PrimeIcons } from 'primeng/api'

import { filterForNavigatedTo } from '@onecx/ngrx-accelerator'
import { PortalMessageService } from '@onecx/angular-integration-interface'
import { DialogState, PortalDialogService } from '@onecx/angular-accelerator'

import { selectBackNavigationPossible } from 'src/app/shared/selectors/onecx.selectors'
import { selectRouteParam, selectUrl } from 'src/app/shared/selectors/router.selectors'
import { Chat, ChatsService } from 'src/app/shared/generated'
import { ChatDetailsActions } from './chat-details.actions'
import { ChatDetailsComponent } from './chat-details.component'
import { chatDetailsSelectors } from './chat-details.selectors'

@Injectable()
export class ChatDetailsEffects {
  constructor(
    private readonly actions$: Actions,
    private readonly chatService: ChatsService,
    private readonly router: Router,
    private readonly store: Store,
    private readonly messageService: PortalMessageService,
    private readonly portalDialogService: PortalDialogService
  ) {}

  navigatedToDetailsPage$ = createEffect(() => {
    return this.actions$.pipe(
      ofType(routerNavigatedAction),
      filterForNavigatedTo(this.router, ChatDetailsComponent),
      concatLatestFrom(() => this.store.select(selectRouteParam('id'))),
      map(([, id]) => {
        return ChatDetailsActions.navigatedToDetailsPage({
          id
        })
      })
    )
  })

  loadChatById$ = createEffect(() => {
    return this.actions$.pipe(
      ofType(ChatDetailsActions.navigatedToDetailsPage),
      switchMap(({ id }) =>
        this.chatService.getChatById(id ?? '').pipe(
          map((chat) =>
            ChatDetailsActions.chatDetailsReceived({
              details: chat
            })
          ),
          catchError((error) =>
            of(
              ChatDetailsActions.chatDetailsLoadingFailed({
                error
              })
            )
          )
        )
      )
    )
  })

  loadAvailableMessages$ = createEffect(() => {
    return this.actions$.pipe(
      ofType(ChatDetailsActions.chatDetailsReceived),
      filter(({ details: chat }) => chat?.id !== undefined && chat.id !== 'new'),
      switchMap(({ details: chat }) => {
        return this.chatService.getChatMessages(chat.id ?? '').pipe(
          map((response) => {
            return ChatDetailsActions.messagesLoaded({
              messages: response
            })
          }),
          catchError((error) =>
            of(
              ChatDetailsActions.messagesLoadingFailed({
                error
              })
            )
          )
        )
      })
    )
  })

  deleteButtonClicked$ = createEffect(() => {
    return this.actions$.pipe(
      ofType(ChatDetailsActions.deleteButtonClicked),
      concatLatestFrom(() => this.store.select(chatDetailsSelectors.selectDetails)),
      mergeMap(([, itemToDelete]) => {
        return this.portalDialogService
          .openDialog<unknown>(
            'CHAT_DETAILS.DELETE.HEADER',
            'CHAT_DETAILS.DELETE.MESSAGE',
            {
              key: 'CHAT_DETAILS.DELETE.CONFIRM',
              icon: PrimeIcons.CHECK
            },
            {
              key: 'CHAT_DETAILS.DELETE.CANCEL',
              icon: PrimeIcons.TIMES
            }
          )
          .pipe(
            map((state): [DialogState<unknown>, Chat | undefined] => {
              return [state, itemToDelete]
            })
          )
      }),
      switchMap(([dialogResult, itemToDelete]) => {
        if (!dialogResult || dialogResult.button == 'secondary') {
          return of(ChatDetailsActions.deleteChatCanceled())
        }
        if (itemToDelete?.id === undefined) {
          throw new Error('Item to delete not found!')
        }

        return this.chatService.deleteChat(itemToDelete.id).pipe(
          map(() => {
            this.messageService.success({
              summaryKey: 'CHAT_DETAILS.DELETE.SUCCESS'
            })
            return ChatDetailsActions.deleteChatSucceeded()
          }),
          catchError((error) => {
            this.messageService.error({
              summaryKey: 'CHAT_DETAILS.DELETE.ERROR'
            })
            return of(
              ChatDetailsActions.deleteChatFailed({
                error
              })
            )
          })
        )
      })
    )
  })

  deleteChatSucceeded$ = createEffect(
    () => {
      return this.actions$.pipe(
        ofType(ChatDetailsActions.deleteChatSucceeded),
        concatLatestFrom(() => this.store.select(selectUrl)),
        tap(([, currentUrl]) => {
          const urlTree = this.router.parseUrl(currentUrl)
          urlTree.queryParams = {}
          urlTree.fragment = null

          const targetUrl = urlTree.toString().split('/').slice(0, -2).join('/')
          Promise.resolve(this.router.navigate([targetUrl])).catch((err) => console.error(err))
        })
      )
    },
    { dispatch: false }
  )

  errorMessages: { action: Action; key: string }[] = [
    {
      action: ChatDetailsActions.chatDetailsLoadingFailed,
      key: 'CHAT_DETAILS.ERROR_MESSAGES.DETAILS_LOADING_FAILED'
    }
  ]

  displayError$ = createEffect(
    () => {
      return this.actions$.pipe(
        tap((action) => {
          const e = this.errorMessages.find((e) => e.action.type === action.type)
          if (e) {
            this.messageService.error({ summaryKey: e.key })
          }
        })
      )
    },
    { dispatch: false }
  )

  navigateBack$ = createEffect(() => {
    return this.actions$.pipe(
      ofType(ChatDetailsActions.navigateBackButtonClicked),
      concatLatestFrom(() => [this.store.select(selectBackNavigationPossible)]),
      switchMap(([, backNavigationPossible]) => {
        if (!backNavigationPossible) {
          return of(ChatDetailsActions.backNavigationFailed())
        }
        globalThis.history.back()
        return of(ChatDetailsActions.backNavigationStarted())
      })
    )
  })
}
