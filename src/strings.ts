/**
 * Every user-facing string, in English and German.
 *
 * English is the default; German is chosen when the locale says so. The same
 * resolved locale also drives all number and date formatting in `format.ts`,
 * so language and formats can never disagree (no English labels around
 * German decimal commas).
 *
 * Deliberately not an i18n framework: two literal objects and one ternary.
 * The `Strings` type keeps both languages honest — a key missing from `de`
 * is a compile error, not a silent English fallback at runtime.
 */

function resolveLocale(): string {
  const raw =
    process.env['SCTUI_LOCALE'] ??
    process.env['LC_ALL'] ??
    process.env['LC_MESSAGES'] ??
    process.env['LANG'] ??
    ''
  // "de_DE.UTF-8" → "de-DE"; the POSIX pseudo-locales mean "no preference".
  const tag = (raw.split('.')[0] ?? '').replace(/_/g, '-')
  if (tag === '' || tag === 'C' || tag === 'POSIX') return 'en-US'
  try {
    new Intl.NumberFormat(tag)
    return tag
  } catch {
    return 'en-US'
  }
}

/** BCP-47 tag for Intl formatters. */
export const LOCALE = resolveLocale()
/** Dictionary language: German for de-* locales, English for everything else. */
export const LANG: 'de' | 'en' = LOCALE.toLowerCase().startsWith('de') ? 'de' : 'en'

const en = {
  // Tabs
  tabOverview: 'Overview',
  tabHoldings: 'Positions',
  tabWatchlist: 'Watchlist',
  tabTransactions: 'Transactions',
  tabSavings: 'Savings plans',

  // Header
  portfolioFallback: 'Portfolio',
  loading: 'loading…',
  noData: 'no data',
  headerToday: ' today',
  headerTotal: 'Total ',
  headerCash: 'Cash ',

  // Status bar
  autoOff: 'auto off',
  auto: (seconds: number) => `auto ${seconds}s`,

  // Key hints
  hintSelect: 'select',
  hintDetail: 'detail',
  hintBack: 'back',
  hintClose: 'close',
  hintTimeframe: 'timeframe',
  hintSearch: 'search',
  hintRefresh: 'refresh',
  hintAuto: 'auto',
  hintHelp: 'help',
  hintQuit: 'quit',
  hintJson: 'json',
  hintRetry: 'retry',

  // App chrome
  terminalTooShort: 'Terminal too short — more rows needed.',
  terminalNarrow: (columns: number) => ` Narrow terminal (${columns} columns) — 100+ looks best.`,

  // Overview
  panelKeyFigures: 'Key figures',
  tileSecurities: 'Securities',
  tileCash: 'Cash',
  tileTotalReturn: 'Total return',
  tilePositions: 'Positions',
  deltaToday: 'today',
  deltaPa: 'p.a.',
  deltaInterest: 'interest',
  panelAllocation: 'Allocation',
  moreCount: (count: number) => `+${count} more`,
  panelMovers: 'Today',
  gainers: 'Gainers',
  losers: 'Losers',
  noPositions: 'No positions',
  noDayChange: 'No day change reported',

  // Tables
  colPosition: 'Position',
  colInstrument: 'Instrument',
  colType: 'Type',
  colShares: 'Shares',
  colPrice: 'Price',
  colValue: 'Value',
  colToday: 'Today',
  colPnl: 'P/L',
  colPnlPct: 'P/L %',
  colWeight: 'Weight',
  colIsin: 'ISIN',
  colDate: 'Date',
  colAmount: 'Amount',
  colStatus: 'Status',
  colInterval: 'Interval',
  colNextExec: 'Next',
  noDataTable: 'No data',
  watchlistEmpty: 'Watchlist is empty',
  noTransactions: 'No transactions',
  noSavingsPlans: 'No savings plans',
  frequencyLabel: (raw: string): string =>
    ({
      MONTHLY: 'monthly',
      WEEKLY: 'weekly',
      BIWEEKLY: 'every 2 weeks',
      TWICE_A_MONTH: 'twice a month',
      QUARTERLY: 'quarterly',
    })[raw] ?? raw.toLowerCase().replace(/_/g, ' '),
  unknownName: 'Unknown',
  scReportedError: 'sc reported an error',

  // Detail pane
  panelInstrument: 'Instrument',
  timeframeHint: '[ ] change',
  quoteStale: 'quote stale',
  noPriceData: 'No price data',
  tooFewPoints: 'Too few points for a chart',
  quoteBid: 'Bid',
  quoteAsk: 'Ask',
  quotePrevClose: 'Prev',
  quoteSpread: 'Spread',
  quoteSinceBuy: 'since buy',

  // Search overlay
  searchTitle: 'Search',
  searchHint: '↑↓ select · ⏎ open · esc close',
  searchPlaceholder: 'Name, symbol or ISIN…',
  searchMinChars: 'Type at least 2 characters.',
  searching: 'searching…',
  searchEmpty: 'Nothing found',
  searchNoDash: 'Search queries must not start with "-"',

  // Debug overlay
  debugTitle: 'Raw JSON',
  debugHint: '↑↓ scroll · esc close',
  debugNoResponse: '(no response)',

  // Help overlay
  helpTitle: 'Keyboard shortcuts',
  helpHint: 'esc or ? to close',
  helpNavigation: 'Navigation',
  helpNavTab: 'Jump to tab',
  helpNavNextTab: 'Next / previous tab',
  helpNavRow: 'Move selection',
  helpNavEnds: 'Top / bottom of list',
  helpNavPage: 'Page up / down',
  helpDetailSection: 'Detail & chart',
  helpDetailOpen: 'Open detail for the selected row',
  helpDetailClose: 'Close detail',
  helpTimeframePrev: 'Chart timeframe back / forward',
  helpTimeframeCycle: 'Cycle timeframe',
  helpDataSection: 'Data',
  helpRefresh: 'Refresh now (bypass cache)',
  helpAuto: 'Auto-refresh on / off',
  helpSearch: 'Instrument search',
  helpJson: 'Raw JSON of the current view',
  helpGeneralSection: 'General',
  helpThisHelp: 'This help',
  helpQuit: 'Quit',
  helpSourceDemo: 'Data source: demo generator (no real data)',
  helpSourceLive: 'Data source: sc — the official Scalable CLI',
  helpReadOnly: 'This app only ever runs read-only sc commands.',

  // Setup view
  setupMissingTitle: 'Scalable CLI missing',
  setupLoginTitle: 'Not logged in',
  setupMissingIntro:
    'This dashboard reads everything through the official Scalable CLI (`sc`). It is not installed yet.',
  setupLoginIntro: 'The CLI is there, but there is no valid session.',
  stepInstallCli: 'Install the Scalable CLI',
  stepEnableCli: 'Enable the CLI in your profile (Settings → Security → "Scalable CLI")',
  stepLogin: 'Log in (OAuth device code in the browser)',
  stepVerify: 'Check that the session works',
  setupDemoLongPrefix: 'No account attached yet? ',
  setupDemoLongSuffix: ' shows the full UI with sample data.',
  setupDemoShortPrefix: 'No account? ',
  setupDemoShortSuffix: ' shows sample data.',
  setupErrorLabel: 'Error: ',
  setupKeys: 'r = retry · q = quit',

  // Demo data
  demoPortfolio: 'Demo portfolio',
  demoIdentity: 'demo@example.com (demo mode)',
  demoInterestName: 'Scalable interest',
  demoTransferName: 'SEPA transfer',

  // sc error hints (status bar)
  hintScNotFound: 'sc not found — `brew install scalable-cli`, or start with --demo',
  hintScAuth: 'Not logged in — run `sc login` (enable the CLI in your Scalable profile first)',
  hintScTimeout: 'sc did not answer in time',
  hintScParse: 'Response was not valid JSON — press `d` to inspect the raw output',
  hintScForbidden: 'Command blocked: this app only runs read-only commands',
  hintScAborted: 'Aborted',

  // CLI
  usage: `
  sctui — terminal dashboard for your Scalable Capital portfolio

  Reads everything through the official Scalable CLI (sc). Only read-only
  sc commands are ever executed.

  Usage
    sctui [options]

  Options
    --demo                 Sample data instead of real (no sc, no account needed)
    --refresh <seconds>    Auto-refresh interval (default: 60)
    --no-refresh           Disable auto-refresh
    --tab <name>           Start tab: overview | holdings | savings | watchlist | transactions
    --sc-bin <path>        Alternative path to the sc binary
    --no-alt-screen        Render in the normal buffer (useful for debugging)
    -h, --help             This help
    -v, --version          Version

  Keys
    1–4 tabs · ↑↓ select · ⏎ detail · [ ] timeframe · / search
    r refresh · a auto-refresh · d raw JSON · ? help · q quit

  Setup (once)
    brew tap ScalableCapital/tap
    brew trust --formula ScalableCapital/tap/scalable-cli
    brew install scalable-cli
    sc login --local-read-only   # enable "Scalable CLI" in your profile first
`,
  cliRefreshInvalid: '--refresh needs a number ≥ 5 (seconds)',
  cliTabInvalid: (tabs: string) => `--tab must be one of ${tabs}`,
  cliScBinMissing: '--sc-bin needs a path',
  cliUnknownOption: (arg: string) => `Unknown option: ${arg}`,
  cliSeeHelp: 'sctui --help for all options.',
}

type Strings = { readonly [K in keyof typeof en]: (typeof en)[K] }

const de: Strings = {
  tabOverview: 'Übersicht',
  tabHoldings: 'Positionen',
  tabWatchlist: 'Watchlist',
  tabTransactions: 'Transaktionen',
  tabSavings: 'Sparpläne',

  portfolioFallback: 'Depot',
  loading: 'lädt…',
  noData: 'keine Daten',
  headerToday: ' heute',
  headerTotal: 'Gesamt ',
  headerCash: 'Cash ',

  autoOff: 'auto aus',
  auto: (seconds: number) => `auto ${seconds}s`,

  hintSelect: 'wählen',
  hintDetail: 'detail',
  hintBack: 'zurück',
  hintClose: 'schließen',
  hintTimeframe: 'zeitraum',
  hintSearch: 'suche',
  hintRefresh: 'refresh',
  hintAuto: 'auto',
  hintHelp: 'hilfe',
  hintQuit: 'ende',
  hintJson: 'json',
  hintRetry: 'erneut versuchen',

  terminalTooShort: 'Terminal zu niedrig — mehr Zeilen nötig.',
  terminalNarrow: (columns: number) => ` Terminal ist schmal (${columns} Spalten) — ab 100 wird es besser.`,

  panelKeyFigures: 'Kennzahlen',
  tileSecurities: 'Wertpapiere',
  tileCash: 'Cash',
  tileTotalReturn: 'Gesamtrendite',
  tilePositions: 'Positionen',
  deltaToday: 'heute',
  deltaPa: 'p.a.',
  deltaInterest: 'Zinsen',
  panelAllocation: 'Allokation',
  moreCount: (count: number) => `+${count} weitere`,
  panelMovers: 'Heute',
  gainers: 'Gewinner',
  losers: 'Verlierer',
  noPositions: 'Keine Positionen',
  noDayChange: 'Keine Tagesveränderung gemeldet',

  colPosition: 'Position',
  colInstrument: 'Instrument',
  colType: 'Typ',
  colShares: 'Stück',
  colPrice: 'Kurs',
  colValue: 'Wert',
  colToday: 'Heute',
  colPnl: 'G/V',
  colPnlPct: 'G/V %',
  colWeight: 'Anteil',
  colIsin: 'ISIN',
  colDate: 'Datum',
  colAmount: 'Betrag',
  colStatus: 'Status',
  colInterval: 'Intervall',
  colNextExec: 'Nächste',
  noDataTable: 'Keine Daten',
  watchlistEmpty: 'Watchlist ist leer',
  noTransactions: 'Keine Transaktionen',
  noSavingsPlans: 'Keine Sparpläne',
  frequencyLabel: (raw: string): string =>
    ({
      MONTHLY: 'monatlich',
      WEEKLY: 'wöchentlich',
      BIWEEKLY: 'alle 2 Wochen',
      TWICE_A_MONTH: '2× im Monat',
      QUARTERLY: 'vierteljährlich',
    })[raw] ?? raw.toLowerCase().replace(/_/g, ' '),
  unknownName: 'Unbekannt',
  scReportedError: 'sc meldete einen Fehler',

  panelInstrument: 'Instrument',
  timeframeHint: '[ ] ändern',
  quoteStale: 'Kurs veraltet',
  noPriceData: 'Keine Kursdaten',
  tooFewPoints: 'Zu wenig Punkte für einen Chart',
  quoteBid: 'Bid',
  quoteAsk: 'Ask',
  quotePrevClose: 'Vortag',
  quoteSpread: 'Spread',
  quoteSinceBuy: 'seit Kauf',

  searchTitle: 'Suche',
  searchHint: '↑↓ auswählen · ⏎ öffnen · esc schließen',
  searchPlaceholder: 'Name, Symbol oder ISIN…',
  searchMinChars: 'Mindestens 2 Zeichen eingeben.',
  searching: 'sucht…',
  searchEmpty: 'Nichts gefunden',
  searchNoDash: 'Suchanfragen dürfen nicht mit "-" beginnen',

  debugTitle: 'Roh-JSON',
  debugHint: '↑↓ scrollen · esc schließen',
  debugNoResponse: '(keine Antwort)',

  helpTitle: 'Tastenkürzel',
  helpHint: 'esc oder ? zum Schließen',
  helpNavigation: 'Navigation',
  helpNavTab: 'Tab direkt wählen',
  helpNavNextTab: 'Nächster / vorheriger Tab',
  helpNavRow: 'Zeile wechseln',
  helpNavEnds: 'Anfang / Ende der Liste',
  helpNavPage: 'Seitenweise blättern',
  helpDetailSection: 'Detail & Chart',
  helpDetailOpen: 'Detail zum ausgewählten Wert öffnen',
  helpDetailClose: 'Detail schließen',
  helpTimeframePrev: 'Chart-Zeitraum zurück / vor',
  helpTimeframeCycle: 'Zeitraum durchschalten',
  helpDataSection: 'Daten',
  helpRefresh: 'Jetzt aktualisieren (Cache umgehen)',
  helpAuto: 'Auto-Refresh an / aus',
  helpSearch: 'Instrumentensuche',
  helpJson: 'Roh-JSON der aktuellen Ansicht',
  helpGeneralSection: 'Allgemein',
  helpThisHelp: 'Diese Hilfe',
  helpQuit: 'Beenden',
  helpSourceDemo: 'Datenquelle: Demo-Generator (keine echten Daten)',
  helpSourceLive: 'Datenquelle: sc — die offizielle Scalable CLI',
  helpReadOnly: 'Diese App führt ausschließlich lesende sc-Befehle aus.',

  setupMissingTitle: 'Scalable CLI fehlt',
  setupLoginTitle: 'Nicht eingeloggt',
  setupMissingIntro:
    'Dieses Dashboard liest alle Daten über die offizielle Scalable CLI (`sc`). Sie ist noch nicht installiert.',
  setupLoginIntro: 'Die CLI ist da, aber es gibt keine gültige Session.',
  stepInstallCli: 'Scalable CLI installieren',
  stepEnableCli: 'CLI im Profil freischalten (Einstellungen → Sicherheit → "Scalable CLI")',
  stepLogin: 'Einloggen (OAuth Device-Code im Browser)',
  stepVerify: 'Prüfen, ob die Session steht',
  setupDemoLongPrefix: 'Solange kein Account dranhängt: ',
  setupDemoLongSuffix: ' zeigt das volle UI mit Beispieldaten.',
  setupDemoShortPrefix: 'Kein Account? ',
  setupDemoShortSuffix: ' zeigt Beispieldaten.',
  setupErrorLabel: 'Fehlermeldung: ',
  setupKeys: 'r = erneut versuchen · q = beenden',

  demoPortfolio: 'Demo-Depot',
  demoIdentity: 'demo@example.com (Demo-Modus)',
  demoInterestName: 'Scalable Zinsen',
  demoTransferName: 'SEPA-Überweisung',

  hintScNotFound: 'sc nicht gefunden — `brew install scalable-cli`, oder starte mit --demo',
  hintScAuth: 'Nicht eingeloggt — `sc login` ausführen (CLI vorher im Scalable-Profil aktivieren)',
  hintScTimeout: 'sc hat nicht rechtzeitig geantwortet',
  hintScParse: 'Antwort war kein gültiges JSON — mit `d` das Rohformat ansehen',
  hintScForbidden: 'Befehl blockiert: diese App führt nur lesende Befehle aus',
  hintScAborted: 'Abgebrochen',

  usage: `
  sctui — Terminal-Dashboard für das Scalable-Depot

  Liest alle Daten über die offizielle Scalable CLI (sc). Es werden
  ausschließlich lesende sc-Befehle ausgeführt.

  Aufruf
    sctui [optionen]

  Optionen
    --demo                 Beispieldaten statt echter (kein sc, kein Account nötig)
    --refresh <sekunden>   Auto-Refresh-Intervall (Standard: 60)
    --no-refresh           Auto-Refresh aus
    --tab <name>           Starttab: overview | holdings | savings | watchlist | transactions
    --sc-bin <pfad>        Abweichender Pfad zur sc-Binary
    --no-alt-screen        Im normalen Puffer rendern (nützlich zum Debuggen)
    -h, --help             Diese Hilfe
    -v, --version          Version

  Tasten
    1–4 Tabs · ↑↓ wählen · ⏎ Detail · [ ] Zeitraum · / Suche
    r Refresh · a Auto-Refresh · d Roh-JSON · ? Hilfe · q Ende

  Einrichtung (einmalig)
    brew tap ScalableCapital/tap
    brew trust --formula ScalableCapital/tap/scalable-cli
    brew install scalable-cli
    sc login --local-read-only   # "Scalable CLI" vorher im Profil aktivieren
`,
  cliRefreshInvalid: '--refresh braucht eine Zahl ≥ 5 (Sekunden)',
  cliTabInvalid: (tabs: string) => `--tab muss eines von ${tabs} sein`,
  cliScBinMissing: '--sc-bin braucht einen Pfad',
  cliUnknownOption: (arg: string) => `Unbekannte Option: ${arg}`,
  cliSeeHelp: 'sctui --help für alle Optionen.',
}

/** The active dictionary. */
export const t: Strings = LANG === 'de' ? de : en
