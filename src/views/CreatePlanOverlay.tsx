import { Box, Text, useInput } from 'ink'
import TextInput from 'ink-text-input'
import type React from 'react'
import { useState } from 'react'
import { Overlay } from '../components/Overlay.js'
import { date, money, truncate } from '../format.js'
import { t } from '../strings.js'
import { theme } from '../theme.js'
import type { DataSource } from '../sc/client.js'
import type { SavingsPlanConfig, SavingsPlanDraft, SavingsPlanPreview } from '../sc/normalize.js'

export interface CreatePlanOverlayProps {
  client: DataSource
  width: number
  height: number
  onCreated: () => void
  onClose: () => void
}

type Step = 'isin' | 'amount' | 'frequency' | 'day' | 'preview' | 'done'

const ISIN_PATTERN = /^[A-Z]{2}[A-Z0-9]{9}[0-9]$/i

/**
 * The only place in the app that can change anything — and it goes out of its
 * way to make that hard to do by accident:
 *
 *  - It refuses outright unless the session was started with --enable-writes.
 *  - The broker's preview (with its confirmation id) is fetched and shown
 *    before anything can be confirmed; without that id the CLI would reject
 *    the confirmation anyway.
 *  - The final step requires typing a confirmation word, not just another ⏎.
 */
export function CreatePlanOverlay({
  client,
  width,
  height,
  onCreated,
  onClose,
}: CreatePlanOverlayProps): React.ReactElement {
  const [step, setStep] = useState<Step>('isin')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | undefined>(undefined)

  const [isin, setIsin] = useState('')
  const [name, setName] = useState<string | undefined>(undefined)
  const [config, setConfig] = useState<SavingsPlanConfig | undefined>(undefined)
  const [amountText, setAmountText] = useState('')
  const [amount, setAmount] = useState<number | undefined>(undefined)
  const [frequencyIndex, setFrequencyIndex] = useState(0)
  const [dayText, setDayText] = useState('')
  const [preview, setPreview] = useState<SavingsPlanPreview | undefined>(undefined)
  const [confirmText, setConfirmText] = useState('')

  const innerWidth = Math.max(20, width - 6)
  const frequencies = config?.frequencies.length ? config.frequencies : ['MONTHLY']
  const frequency = frequencies[frequencyIndex] ?? 'MONTHLY'

  const draft = (): SavingsPlanDraft => ({
    isin: isin.trim().toUpperCase(),
    amount: amount ?? 0,
    frequency,
    dayOfMonth: Number.parseInt(dayText, 10) || config?.defaultDayOfMonth || undefined,
  })

  const fail = (err: unknown): void => {
    setBusy(false)
    setError(err instanceof Error ? err.message : String(err))
  }

  const submitIsin = (): void => {
    const candidate = isin.trim().toUpperCase()
    if (!ISIN_PATTERN.test(candidate)) {
      setError(t.planInvalidIsin)
      return
    }
    setError(undefined)
    setBusy(true)
    Promise.all([
      client.savingsPlanConfig(candidate),
      client.quote(candidate).catch(() => undefined),
    ])
      .then(([configResult, quoteResult]) => {
        setConfig(configResult.value)
        setName(quoteResult?.value.name)
        const defaultIndex = configResult.value.frequencies.indexOf(configResult.value.defaultFrequency ?? '')
        setFrequencyIndex(Math.max(0, defaultIndex))
        setDayText(String(configResult.value.defaultDayOfMonth ?? 4))
        setBusy(false)
        setStep('amount')
      })
      .catch(fail)
  }

  const submitAmount = (): void => {
    const value = Number.parseFloat(amountText.replace(',', '.'))
    const min = config?.minAmount ?? 1
    const max = config?.maxAmount ?? Number.POSITIVE_INFINITY
    if (!Number.isFinite(value) || value < min || value > max) {
      setError(t.planInvalidAmount)
      return
    }
    setError(undefined)
    setAmount(value)
    setStep('frequency')
  }

  const submitDay = (): void => {
    const value = Number.parseInt(dayText, 10)
    if (!Number.isFinite(value) || value < 1 || value > 31) {
      setError(t.planInvalidDay)
      return
    }
    setError(undefined)
    setBusy(true)
    client
      .previewSavingsPlan(draft())
      .then((result) => {
        setPreview(result.value)
        setBusy(false)
        if (!result.value.confirmationId) setError(t.planNoConfirmationId)
        setStep('preview')
      })
      .catch(fail)
  }

  const submitConfirm = (): void => {
    const confirmationId = preview?.confirmationId
    if (!confirmationId || confirmText.trim().toLowerCase() !== t.planConfirmWord) return
    setError(undefined)
    setBusy(true)
    client
      .confirmSavingsPlan(draft(), confirmationId)
      .then(() => {
        setBusy(false)
        setStep('done')
        onCreated()
      })
      .catch(fail)
  }

  useInput((_input, key) => {
    if (key.escape) {
      if (busy) return
      if (step === 'isin' || step === 'done' || !client.canWrite) onClose()
      else if (step === 'amount') setStep('isin')
      else if (step === 'frequency') setStep('amount')
      else if (step === 'day') setStep('frequency')
      else if (step === 'preview') setStep('day')
      setError(undefined)
      return
    }
    if (step === 'frequency') {
      if (key.leftArrow) setFrequencyIndex((index) => (index - 1 + frequencies.length) % frequencies.length)
      else if (key.rightArrow) setFrequencyIndex((index) => (index + 1) % frequencies.length)
      else if (key.return) {
        setError(undefined)
        setStep('day')
      }
    }
  })

  // Opting out is the default: without --enable-writes this screen only
  // explains how to opt in. Nothing below it is reachable.
  if (!client.canWrite) {
    return (
      <Overlay title={t.planWizardTitle} hint="esc" width={width} height={height}>
        <Text color={theme.warn}>{truncate(t.planWriteOff, innerWidth)}</Text>
        <Text color={theme.muted}>{truncate(t.planWriteOffHint, innerWidth)}</Text>
      </Overlay>
    )
  }

  // Border (2) + title (1). Every row below is budgeted by hand: this overlay
  // once rendered two rows more than its height at 20 lines, and Ink answered
  // by painting "Nächste" over "Intervall" — the house bug class, in the one
  // screen where a garbled row could precede a money action.
  const inner = Math.max(3, height - 3)
  const footerRows = (busy ? 1 : 0) + (error ? 1 : 0) + (client.kind === 'demo' ? 1 : 0)
  const budget = inner - footerRows

  const rows: React.ReactElement[] = []
  const push = (key: string, element: React.ReactElement): void => {
    rows.push(<Box key={key}>{element}</Box>)
  }
  const gapIfRoom = (key: string, needed: number): void => {
    if (rows.length + needed + 1 <= budget) rows.push(<Text key={key}> </Text>)
  }
  const label = (key: string, text: string): void => {
    push(key, <Text color={theme.muted}>{truncate(text, innerWidth)}</Text>)
  }
  const input = (key: string, value: string, onChange: (v: string) => void, onSubmit: () => void): void => {
    push(
      key,
      <>
        <Text color={theme.accent}>❯ </Text>
        <TextInput value={value} onChange={onChange} onSubmit={onSubmit} showCursor focus={!busy} />
      </>,
    )
  }

  if (step === 'isin' || step === 'amount' || step === 'day' || step === 'frequency') {
    // Name, label, input — plus breathing room only where the budget allows.
    if (name && rows.length + 3 < budget) {
      push('name', (
        <Text color={theme.fg} bold>
          {truncate(name, innerWidth)}
        </Text>
      ))
      gapIfRoom('gap-name', 2)
    }
    if (step === 'isin') {
      label('label', t.planStepIsin)
      input('input', isin, setIsin, submitIsin)
    } else if (step === 'amount') {
      label('label', t.planStepAmount(money(config?.minAmount ?? 1), money(config?.maxAmount)))
      input('input', amountText, setAmountText, submitAmount)
    } else if (step === 'day') {
      label('label', t.planStepDay)
      input('input', dayText, setDayText, submitDay)
    } else {
      label('label', t.planStepFrequency)
      push('options', (
        <>
          {frequencies.map((entry, index) => (
            <Text
              key={entry}
              color={index === frequencyIndex ? theme.accent : theme.dim}
              bold={index === frequencyIndex}
            >
              {index > 0 ? '   ' : ''}
              {t.frequencyLabel(entry)}
            </Text>
          ))}
        </>
      ))
    }
  }

  if (step === 'preview' && preview) {
    push('title', (
      <Text color={theme.warn} bold>
        {truncate(t.planPreviewTitle, innerWidth)}
      </Text>
    ))
    gapIfRoom('gap-title', 6 + preview.warnings.length)
    push('r-name', <Row label={t.colInstrument} value={truncate(preview.name ?? name ?? preview.isin ?? isin, Math.max(0, innerWidth - 14))} />)
    push('r-amount', <Row label={t.colAmount} value={money(preview.amount ?? amount)} strong />)
    push('r-freq', <Row label={t.colInterval} value={t.frequencyLabel(preview.frequency ?? frequency)} />)
    push('r-next', <Row label={t.colNextExec} value={preview.firstExecution ? date(preview.firstExecution) : `${dayText}.`} />)
    for (const [index, warning] of preview.warnings.entries()) {
      push(`warn-${index}`, <Text color={theme.warn}>{truncate(`! ${warning}`, innerWidth)}</Text>)
    }
    gapIfRoom('gap-prompt', 2)
    label('prompt', t.planConfirmPrompt(t.planConfirmWord))
    input('confirm', confirmText, setConfirmText, submitConfirm)
  }

  if (step === 'done') {
    push('done', (
      <Text color={theme.up} bold>
        {t.planCreated}
      </Text>
    ))
    push('done-hint', <Text color={theme.dim}>{t.planCreatedHint}</Text>)
  }

  return (
    <Overlay title={t.planWizardTitle} hint={t.planWizardNext} width={width} height={height}>
      {rows.slice(0, budget)}
      {busy ? (
        <Text color={theme.dim}>{step === 'preview' ? t.planConfirming : t.planPreviewLoading}</Text>
      ) : null}
      {error ? <Text color={theme.error}>{truncate(error, innerWidth)}</Text> : null}
      {client.kind === 'demo' ? <Text color={theme.dim}>{truncate(t.planDemoNote, innerWidth)}</Text> : null}
    </Overlay>
  )
}

function Row({ label, value, strong = false }: { label: string; value: string; strong?: boolean }): React.ReactElement {
  return (
    <Box>
      <Text color={theme.dim}>{label.padEnd(14)}</Text>
      <Text color={strong ? theme.fg : theme.muted} bold={strong}>
        {value}
      </Text>
    </Box>
  )
}
