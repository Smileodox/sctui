import { Box, Text, useApp, useInput, useWindowSize } from 'ink'
import type React from 'react'
import { useCallback, useMemo, useState } from 'react'
import { Header } from './components/Header.js'
import { truncate } from './format.js'
import { StatusBar } from './components/StatusBar.js'
import { TabBar, type Tab } from './components/TabBar.js'
import { useInterval, useResource, useSpinnerFrame, useTick } from './hooks/useResource.js'
import { glyphs, theme } from './theme.js'
import { ScError } from './sc/exec.js'
import { TIMEFRAMES, type DataSource, type Timeframe } from './sc/client.js'
import type { Json } from './sc/json.js'
import { t } from './strings.js'
import { CreatePlanOverlay } from './views/CreatePlanOverlay.js'
import { DebugOverlay } from './views/DebugOverlay.js'
import { DetailPane } from './views/DetailPane.js'
import { HelpOverlay } from './views/HelpOverlay.js'
import { HoldingsView } from './views/HoldingsView.js'
import { OverviewView } from './views/OverviewView.js'
import { SavingsPlansView } from './views/SavingsPlansView.js'
import { SearchOverlay } from './views/SearchOverlay.js'
import { TransactionDetailPane } from './views/TransactionDetailPane.js'
import { SetupView } from './views/SetupView.js'
import { TransactionsView } from './views/TransactionsView.js'
import { WatchlistView } from './views/WatchlistView.js'

const TABS: readonly Tab[] = [
  { id: 'overview', label: t.tabOverview },
  { id: 'holdings', label: t.tabHoldings },
  { id: 'savings', label: t.tabSavings },
  { id: 'watchlist', label: t.tabWatchlist },
  { id: 'transactions', label: t.tabTransactions },
]

type TabId = (typeof TABS)[number]['id']
type OverlayId = 'help' | 'search' | 'debug' | 'create' | null

export interface AppProps {
  client: DataSource
  /** Seconds between automatic refreshes, or `null` to start paused. */
  autoRefreshSeconds: number | null
  initialTab?: TabId
}

/** An instrument the detail pane can show, wherever the selection came from. */
interface DetailTarget {
  isin: string
  name?: string
}

export function App({ client, autoRefreshSeconds, initialTab = 'overview' }: AppProps): React.ReactElement {
  const { exit } = useApp()
  const size = useWindowSize()

  const [tab, setTab] = useState<TabId>(initialTab)
  const [visited, setVisited] = useState<Set<TabId>>(() => new Set<TabId>([initialTab]))
  const [selection, setSelection] = useState<Record<string, number>>({})
  const [detailOpen, setDetailOpen] = useState(false)
  const [pinnedTarget, setPinnedTarget] = useState<DetailTarget | undefined>(undefined)
  const [timeframe, setTimeframe] = useState<Timeframe>('1m')
  const [overlay, setOverlay] = useState<OverlayId>(null)
  const [debugScroll, setDebugScroll] = useState(0)
  const [autoSeconds, setAutoSeconds] = useState<number | null>(autoRefreshSeconds)
  // `n` swaps the detail pane's chart area for headlines. Sticky on purpose:
  // whoever reads news for one instrument usually wants it for the next too.
  const [newsMode, setNewsMode] = useState(false)

  useTick(1000) // keeps the "aktualisiert vor …" clock honest

  // -- data ---------------------------------------------------------------

  const overview = useResource(({ signal, force }) => client.overview({ signal, force }), [client])
  const holdings = useResource(({ signal, force }) => client.holdings({ signal, force }), [client])
  const identity = useResource(({ signal, force }) => client.whoami({ signal, force }), [client])

  const overnight = useResource(({ signal, force }) => client.overnight({ signal, force }), [client], {
    enabled: visited.has('overview'),
  })
  const savings = useResource(({ signal, force }) => client.savingsPlans({ signal, force }), [client], {
    enabled: visited.has('savings'),
  })
  const watchlist = useResource(({ signal, force }) => client.watchlist({ signal, force }), [client], {
    enabled: visited.has('watchlist'),
  })
  const transactions = useResource(
    ({ signal, force }) => client.transactions({ signal, force }),
    [client],
    { enabled: visited.has('transactions') },
  )

  const holdingRows = holdings.data?.value ?? []
  const savingsRows = savings.data?.value ?? []
  const watchRows = watchlist.data?.value ?? []
  const transactionRows = transactions.data?.value ?? []

  const rowCount = tab === 'holdings' ? holdingRows.length : tab === 'savings' ? savingsRows.length : tab === 'watchlist' ? watchRows.length : tab === 'transactions' ? transactionRows.length : 0
  const selectedIndex = Math.min(selection[tab] ?? 0, Math.max(0, rowCount - 1))

  /** What the detail pane should show: a search pick, else the selected row. */
  const detailTarget = useMemo<DetailTarget | undefined>(() => {
    if (pinnedTarget) return pinnedTarget
    if (tab === 'holdings') {
      const row = holdingRows[selectedIndex]
      return row ? { isin: row.isin, name: row.name } : undefined
    }
    if (tab === 'savings') {
      const row = savingsRows[selectedIndex]
      return row ? { isin: row.isin, name: row.name } : undefined
    }
    if (tab === 'watchlist') {
      const row = watchRows[selectedIndex]
      return row ? { isin: row.isin, name: row.name } : undefined
    }
    if (tab === 'transactions') {
      const row = transactionRows[selectedIndex]
      return row?.isin ? { isin: row.isin, name: row.name } : undefined
    }
    return undefined
  }, [pinnedTarget, tab, selectedIndex, holdingRows, savingsRows, watchRows, transactionRows])

  const detailIsin = detailTarget?.isin

  // On the transactions tab, ⏎ means "show me this transaction", not the
  // instrument chart — cash rows have no ISIN but still have a story to tell.
  // A search pick (pinnedTarget) wins, because that was an explicit choice.
  const txSelected = tab === 'transactions' && !pinnedTarget ? transactionRows[selectedIndex] : undefined
  const txPaneActive = detailOpen && !!txSelected?.id
  const detailEnabled = detailOpen && !txPaneActive && !!detailIsin && detailIsin !== '—'

  const quote = useResource(
    ({ signal, force }) => client.quote(detailIsin as string, { signal, force }),
    [client, detailIsin],
    { enabled: detailEnabled },
  )
  const chart = useResource(
    ({ signal, force }) => client.chart(detailIsin as string, timeframe, { signal, force }),
    [client, detailIsin, timeframe],
    { enabled: detailEnabled },
  )
  const news = useResource(
    ({ signal, force }) => client.news(detailIsin as string, { signal, force }),
    [client, detailIsin],
    { enabled: detailEnabled && newsMode },
  )
  const txDetails = useResource(
    ({ signal, force }) => client.transactionDetails(txSelected?.id as string, { signal, force }),
    [client, txSelected?.id],
    { enabled: txPaneActive },
  )

  const refreshAll = useCallback(
    (force = true) => {
      overview.reload(force)
      holdings.reload(force)
      if (visited.has('overview')) overnight.reload(force)
      if (visited.has('savings')) savings.reload(force)
      if (visited.has('watchlist')) watchlist.reload(force)
      if (visited.has('transactions')) transactions.reload(force)
      if (detailEnabled) {
        quote.reload(force)
        chart.reload(force)
        if (newsMode) news.reload(force)
      }
      if (txPaneActive) txDetails.reload(force)
    },
    [overview, holdings, overnight, savings, watchlist, transactions, quote, chart, news, txDetails, visited, detailEnabled, newsMode, txPaneActive],
  )

  useInterval(() => refreshAll(true), autoSeconds === null ? null : autoSeconds * 1000)

  // -- current-view bookkeeping -------------------------------------------

  const activeResource =
    tab === 'holdings' ? holdings : tab === 'savings' ? savings : tab === 'watchlist' ? watchlist : tab === 'transactions' ? transactions : overview

  const loading =
    overview.loading ||
    holdings.loading ||
    activeResource.loading ||
    (detailEnabled && (quote.loading || chart.loading || (newsMode && news.loading))) ||
    (txPaneActive && txDetails.loading)

  const firstError = [
    overview.error,
    holdings.error,
    activeResource.error,
    quote.error,
    chart.error,
    ...(txPaneActive ? [txDetails.error] : []),
    ...(newsMode && detailEnabled ? [news.error] : []),
  ].find((e): e is Error => e !== undefined)

  const fatalError =
    overview.data === undefined && overview.error instanceof ScError &&
    (overview.error.code === 'SC_NOT_FOUND' || overview.error.code === 'SC_AUTH')
      ? overview.error
      : undefined

  const debugPayload: { title: string; command?: string; payload: Json | undefined } = useMemo(() => {
    if (txPaneActive) {
      return { title: 'transaction-details', command: txDetails.data?.command, payload: txDetails.data?.raw }
    }
    if (detailOpen && detailEnabled) {
      if (newsMode) return { title: 'news', command: news.data?.command, payload: news.data?.raw }
      return { title: 'quote', command: quote.data?.command, payload: quote.data?.raw }
    }
    switch (tab) {
      case 'holdings':
        return { title: 'holdings', command: holdings.data?.command, payload: holdings.data?.raw }
      case 'savings':
        return { title: 'savings-plans', command: savings.data?.command, payload: savings.data?.raw }
      case 'watchlist':
        return { title: 'watchlist', command: watchlist.data?.command, payload: watchlist.data?.raw }
      case 'transactions':
        return { title: 'transactions', command: transactions.data?.command, payload: transactions.data?.raw }
      default:
        return { title: 'overview', command: overview.data?.command, payload: overview.data?.raw }
    }
  }, [tab, detailOpen, detailEnabled, txPaneActive, newsMode, quote.data, news.data, txDetails.data, holdings.data, savings.data, watchlist.data, transactions.data, overview.data])

  // -- input ---------------------------------------------------------------

  const moveSelection = useCallback(
    (delta: number) => {
      setPinnedTarget(undefined)
      setSelection((current) => {
        const index = Math.min(current[tab] ?? 0, Math.max(0, rowCount - 1))
        const next = Math.max(0, Math.min(Math.max(0, rowCount - 1), index + delta))
        return { ...current, [tab]: next }
      })
    },
    [tab, rowCount],
  )

  const gotoTab = useCallback((next: TabId) => {
    setTab(next)
    setPinnedTarget(undefined)
    setVisited((current) => (current.has(next) ? current : new Set(current).add(next)))
  }, [])

  const cycleTimeframe = useCallback((delta: number) => {
    setTimeframe((current) => {
      const index = TIMEFRAMES.indexOf(current)
      const next = (index + delta + TIMEFRAMES.length) % TIMEFRAMES.length
      return TIMEFRAMES[next] as Timeframe
    })
  }, [])

  useInput(
    (input, key) => {
      // Overlays get first refusal on the keys they own.
      if (overlay === 'debug') {
        if (key.escape || input === 'd' || input === 'q') {
          setOverlay(null)
          setDebugScroll(0)
          return
        }
        if (key.downArrow || input === 'j') setDebugScroll((s) => s + 1)
        else if (key.upArrow || input === 'k') setDebugScroll((s) => Math.max(0, s - 1))
        else if (key.pageDown) setDebugScroll((s) => s + 20)
        else if (key.pageUp) setDebugScroll((s) => Math.max(0, s - 20))
        else if (input === 'g') setDebugScroll(0)
        return
      }
      if (overlay === 'help') {
        if (key.escape || input === '?' || input === 'q') setOverlay(null)
        return
      }

      if (input === 'q' || (key.ctrl && input === 'c')) {
        exit()
        return
      }
      if (input === '?') {
        setOverlay('help')
        return
      }
      if (input === '/') {
        setOverlay('search')
        return
      }
      if (input === 'd') {
        setDebugScroll(0)
        setOverlay('debug')
        return
      }
      if (input === 'r') {
        refreshAll(true)
        return
      }
      if (input === 'a') {
        setAutoSeconds((current) => (current === null ? (autoRefreshSeconds ?? 60) : null))
        return
      }

      // Tabs
      const digit = Number.parseInt(input, 10)
      if (!Number.isNaN(digit) && digit >= 1 && digit <= TABS.length) {
        gotoTab(TABS[digit - 1]!.id)
        return
      }
      if (key.tab) {
        const index = TABS.findIndex((t) => t.id === tab)
        const next = key.shift ? (index - 1 + TABS.length) % TABS.length : (index + 1) % TABS.length
        gotoTab(TABS[next]!.id)
        return
      }

      // Detail pane
      if (key.return || key.rightArrow || input === 'l') {
        if (detailTarget || txSelected?.id) setDetailOpen(true)
        return
      }
      if (key.escape || key.leftArrow || input === 'h') {
        if (detailOpen) {
          setDetailOpen(false)
          setPinnedTarget(undefined)
        }
        return
      }
      if (input === 't') {
        cycleTimeframe(1)
        return
      }
      if (input === 'n') {
        if (detailOpen && !txPaneActive) setNewsMode((mode) => !mode)
        return
      }
      if (input === '+') {
        if (tab === 'savings') setOverlay('create')
        return
      }
      if (input === ']') {
        cycleTimeframe(1)
        return
      }
      if (input === '[') {
        cycleTimeframe(-1)
        return
      }

      // List navigation
      if (key.downArrow || input === 'j') moveSelection(1)
      else if (key.upArrow || input === 'k') moveSelection(-1)
      else if (key.pageDown) moveSelection(10)
      else if (key.pageUp) moveSelection(-10)
      else if (input === 'g') moveSelection(-rowCount)
      else if (input === 'G') moveSelection(rowCount)
    },
    { isActive: overlay !== 'search' && overlay !== 'create' },
  )

  // -- layout --------------------------------------------------------------

  const width = Math.max(60, size.columns)
  const narrow = size.columns < 80
  // Error line, key hints, and the narrow-terminal note all sit below the content.
  const statusHeight = (firstError ? 2 : 1) + (narrow ? 1 : 0)
  // Never more than the terminal actually has: a floor here would not give the
  // content more room, it would only push the status bar off the bottom.
  const contentHeight = Math.max(0, size.rows - 2 /* header */ - 1 - 1 /* tabs */ - 1 - statusHeight)
  // Border, title and one row — below that a panel has nothing to show.
  const roomForContent = contentHeight >= 5

  const spinnerFrame = useSpinnerFrame(loading, glyphs.spinner.length)

  const showDetail = detailOpen && (detailEnabled || txPaneActive) && tab !== 'overview'
  // Below this, a split would leave the list too narrow to read, so the detail
  // takes over the whole content area instead.
  const SPLIT_MIN_WIDTH = 96
  const splitDetail = showDetail && width >= SPLIT_MIN_WIDTH
  const detailWidth = !showDetail ? 0 : splitDetail ? Math.max(42, Math.min(74, Math.floor(width * 0.42))) : width
  const listWidth = width - detailWidth

  const keyHints: ReadonlyArray<readonly [string, string]> = overlay
    ? ([['esc', t.hintClose]] as const)
    : fatalError
      ? // Nothing loaded, so navigation keys would only produce more errors.
        ([
          ['r', t.hintRetry],
          ['?', t.hintHelp],
          ['q', t.hintQuit],
        ] as const)
      : ([
          ['↑↓', t.hintSelect],
          showDetail ? (['esc', t.hintBack] as const) : (['⏎', t.hintDetail] as const),
          ['[ ]', t.hintTimeframe],
          ...(showDetail && !txPaneActive ? ([['n', t.hintNews]] as const) : []),
          ...(tab === 'savings' && !showDetail ? ([['+', t.hintNewPlan]] as const) : []),
          ['/', t.hintSearch],
          ['r', t.hintRefresh],
          ['a', t.hintAuto],
          // Least-to-most essential from here: the status bar drops hints from
          // the right when the terminal is narrow, and `d` is a diagnostic key
          // that the help overlay documents anyway.
          ['?', t.hintHelp],
          ['q', t.hintQuit],
          ['d', t.hintJson],
        ] as const)

  return (
    <Box flexDirection="column" width={width}>
      <Header
        summary={overview.data?.value}
        width={width}
        mode={client.kind}
        identity={identity.data?.value}
        loading={overview.loading}
      />

      <Box marginTop={1}>
        <TabBar tabs={TABS} activeId={tab} width={width} />
      </Box>

      <Box marginTop={1} height={contentHeight}>
        {!roomForContent ? (
          <Text color={theme.dim}>{truncate(t.terminalTooShort, width)}</Text>
        ) : fatalError ? (
          <SetupView error={fatalError} width={width} height={contentHeight} />
        ) : overlay === 'help' ? (
          <HelpOverlay width={width} height={contentHeight} mode={client.kind} />
        ) : overlay === 'debug' ? (
          <DebugOverlay
            title={debugPayload.title}
            command={debugPayload.command}
            payload={debugPayload.payload}
            width={width}
            height={contentHeight}
            scrollOffset={debugScroll}
          />
        ) : overlay === 'create' ? (
          <CreatePlanOverlay
            client={client}
            width={width}
            height={contentHeight}
            onCreated={() => savings.reload(true)}
            onClose={() => setOverlay(null)}
          />
        ) : overlay === 'search' ? (
          <SearchOverlay
            client={client}
            width={width}
            height={contentHeight}
            onSelect={(result) => {
              setOverlay(null)
              setPinnedTarget({ isin: result.isin, name: result.name })
              setDetailOpen(true)
              if (tab === 'overview') gotoTab('watchlist')
            }}
            onClose={() => setOverlay(null)}
          />
        ) : (
          <>
            {showDetail && !splitDetail ? null : tab === 'overview' ? (
              <OverviewView
                summary={overview.data?.value}
                holdings={holdingRows}
                overnight={overnight.data?.value}
                width={width}
                height={contentHeight}
                loading={overview.loading || holdings.loading}
              />
            ) : tab === 'holdings' ? (
              <HoldingsView
                holdings={holdingRows}
                width={listWidth}
                height={contentHeight}
                selectedIndex={selectedIndex}
                focused={!showDetail}
                loading={holdings.loading}
              />
            ) : tab === 'savings' ? (
              <SavingsPlansView
                plans={savingsRows}
                width={listWidth}
                height={contentHeight}
                selectedIndex={selectedIndex}
                focused={!showDetail}
                loading={savings.loading}
              />
            ) : tab === 'watchlist' ? (
              <WatchlistView
                items={watchRows}
                width={listWidth}
                height={contentHeight}
                selectedIndex={selectedIndex}
                focused={!showDetail}
                loading={watchlist.loading}
              />
            ) : (
              <TransactionsView
                transactions={transactionRows}
                width={listWidth}
                height={contentHeight}
                selectedIndex={selectedIndex}
                focused={!showDetail}
                loading={transactions.loading}
              />
            )}

            {showDetail && txPaneActive ? (
              <TransactionDetailPane
                details={txDetails.data?.value}
                width={detailWidth}
                height={contentHeight}
                focused
                loading={txDetails.loading}
                error={txDetails.error}
              />
            ) : showDetail && detailTarget ? (
              <DetailPane
                isin={detailTarget.isin}
                name={detailTarget.name}
                quote={quote.data?.value}
                chart={chart.data?.value}
                timeframe={timeframe}
                width={detailWidth}
                height={contentHeight}
                focused
                loading={quote.loading || chart.loading}
                error={chart.error}
                newsMode={newsMode}
                news={news.data?.value}
                newsLoading={news.loading}
              />
            ) : null}
          </>
        )}
      </Box>

      <StatusBar
        width={width}
        keys={keyHints}
        loading={loading}
        spinnerFrame={spinnerFrame}
        error={
          firstError
            ? {
                message: firstError.message,
                hint: firstError instanceof ScError ? firstError.hint : undefined,
              }
            : undefined
        }
        fetchedAt={activeResource.fetchedAt ?? overview.fetchedAt}
        autoRefreshSeconds={autoSeconds}
      />

      {narrow ? (
        <Text color={theme.warn}>{truncate(t.terminalNarrow(size.columns), width)}</Text>
      ) : null}
    </Box>
  )
}
