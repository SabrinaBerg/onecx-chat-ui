import { Injectable, SkipSelf } from '@angular/core'
import { ActivatedRoute, Router } from '@angular/router'
import { Actions, createEffect, ofType } from '@ngrx/effects'
import { concatLatestFrom } from '@ngrx/operators'
import { routerNavigatedAction } from '@ngrx/router-store'
import { Action, Store } from '@ngrx/store'
import { catchError, map, of, switchMap, tap } from 'rxjs'
import equal from 'fast-deep-equal'

import {
  filterForNavigatedTo,
  filterOutOnlyQueryParamsChanged,
  filterOutQueryParamsHaveNotChanged
} from '@onecx/ngrx-accelerator'
import { ExportDataService } from '@onecx/angular-accelerator'
import { PortalMessageService } from '@onecx/angular-integration-interface'

import { ChatsService } from 'src/app/shared/generated'
import { selectUrl } from 'src/app/shared/selectors/router.selectors'
import { ChatSearchActions } from './chat-search.actions'
import { ChatSearchComponent } from './chat-search.component'
import { chatSearchCriteriasSchema } from './chat-search.parameters'
import { chatSearchSelectors, selectChatSearchViewModel } from './chat-search.selectors'

@Injectable()
export class ChatSearchEffects {
  constructor(
    private readonly actions$: Actions,
    @SkipSelf() private readonly route: ActivatedRoute,
    private readonly chatService: ChatsService,
    private readonly router: Router,
    private readonly store: Store,
    private readonly messageService: PortalMessageService,
    private readonly exportDataService: ExportDataService
  ) {}

  syncParamsToUrl$ = createEffect(
    () => {
      return this.actions$.pipe(
        ofType(ChatSearchActions.searchButtonClicked, ChatSearchActions.resetButtonClicked),
        concatLatestFrom(() => [this.store.select(chatSearchSelectors.selectCriteria), this.route.queryParams]),
        tap(([, criteria, queryParams]) => {
          const results = chatSearchCriteriasSchema.safeParse(queryParams)
          if (!results.success || !equal(criteria, results.data)) {
            const params = {
              ...criteria
            }
            Promise.resolve(
              this.router.navigate([], {
                relativeTo: this.route,
                queryParams: params,
                replaceUrl: true,
                onSameUrlNavigation: 'ignore'
              })
            ).catch((err) => console.error(err))
          }
        })
      )
    },
    { dispatch: false }
  )

  detailsButtonClicked$ = createEffect(
    () => {
      return this.actions$.pipe(
        ofType(ChatSearchActions.detailsButtonClicked),
        concatLatestFrom(() => this.store.select(selectUrl)),
        tap(([action, currentUrl]) => {
          const urlTree = this.router.parseUrl(currentUrl)
          urlTree.queryParams = {}
          urlTree.fragment = null
          Promise.resolve(this.router.navigate([urlTree.toString(), 'details', action.id])).catch((err) =>
            console.error(err)
          )
        })
      )
    },
    { dispatch: false }
  )

  searchByUrl$ = createEffect(() => {
    return this.actions$.pipe(
      ofType(routerNavigatedAction),
      filterForNavigatedTo(this.router, ChatSearchComponent),
      filterOutQueryParamsHaveNotChanged(this.router, chatSearchCriteriasSchema, true),
      concatLatestFrom(() => this.store.select(chatSearchSelectors.selectCriteria)),
      switchMap(([, searchCriteria]) => this.performSearch(searchCriteria))
    )
  })

  performSearch(searchCriteria: Record<string, any>) {
    return this.chatService
      .searchChats({
        ...Object.entries(searchCriteria).reduce(
          (acc, [key, value]) => ({
            ...acc,
            [key]: value instanceof Date ? value.toISOString() : value
          }),
          {}
        )
      })
      .pipe(
        map(({ stream, totalElements }) =>
          ChatSearchActions.chatSearchResultsReceived({
            results: stream ?? [],
            totalNumberOfResults: totalElements ?? 0
          })
        ),
        catchError((error) =>
          of(
            ChatSearchActions.chatSearchResultsLoadingFailed({
              error
            })
          )
        )
      )
  }

  rehydrateChartVisibility$ = createEffect(() => {
    return this.actions$.pipe(
      ofType(routerNavigatedAction),
      filterForNavigatedTo(this.router, ChatSearchComponent),
      filterOutOnlyQueryParamsChanged(this.router),
      map(() =>
        ChatSearchActions.chartVisibilityRehydrated({
          visible: localStorage.getItem('chatChartVisibility') === 'true'
        })
      )
    )
  })

  saveChartVisibility$ = createEffect(
    () => {
      return this.actions$.pipe(
        ofType(ChatSearchActions.chartVisibilityToggled),
        concatLatestFrom(() => this.store.select(chatSearchSelectors.selectChartVisible)),
        tap(([, chartVisible]) => {
          localStorage.setItem('chatChartVisibility', String(chartVisible))
        })
      )
    },
    { dispatch: false }
  )

  exportData$ = createEffect(
    () => {
      return this.actions$.pipe(
        ofType(ChatSearchActions.chartVisibilityToggled),
        concatLatestFrom(() => this.store.select(selectChatSearchViewModel)),
        map(([, viewModel]) => {
          Promise.resolve(
            this.exportDataService.exportCsv(viewModel.displayedColumns, viewModel.results, 'Chat.csv')
          ).catch((err) => console.error(err))
        })
      )
    },
    { dispatch: false }
  )

  errorMessages: { action: Action; key: string }[] = [
    {
      action: ChatSearchActions.chatSearchResultsLoadingFailed,
      key: 'CHAT_SEARCH.ERROR_MESSAGES.SEARCH_RESULTS_LOADING_FAILED'
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
}
