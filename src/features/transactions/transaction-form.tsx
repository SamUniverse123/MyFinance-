import * as React from "react"
import { useForm } from "@tanstack/react-form"
import * as z from "zod"

import { cn } from "@/lib/utils.ts"
import { useIsMobile } from "#/hooks/use-mobile.ts"
import { getSymbol, toCurrencyCode } from "#/lib/currency"
import type { Account } from "@/features/accounts/api"
import { Button } from "@/components/ui/button.tsx"
import { Input } from "@/components/ui/input.tsx"
import { Textarea } from "@/components/ui/textarea.tsx"
import { Spinner } from "@/components/ui/spinner"
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field.tsx"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog.tsx"
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer.tsx"

export type TxnDirection = "expense" | "income"
export type TxnStatus = "pending" | "cleared" | "reconciled"

export type TransactionFormValues = {
  accountId: string
  direction: TxnDirection
  amount: string
  date: string
  payeeName: string
  note: string
  status: TxnStatus
}

const STATUSES: { value: TxnStatus; label: string }[] = [
  { value: "cleared", label: "Cleared" },
  { value: "pending", label: "Pending" },
  { value: "reconciled", label: "Reconciled" },
]

/** Balance text → integer minor units. "12.50" → 1250. */
export function toMinorUnits(input: string): number {
  if (!input.trim()) return 0
  return Math.round(Number(input) * 100)
}

/** abs(minor units) → magnitude text for prefilling. -1250 → "12.50". */
export function magnitudeText(minorUnits: number): string {
  return (Math.abs(minorUnits) / 100).toFixed(2)
}

/** Today as a local `YYYY-MM-DD` (native date inputs expect this format). */
export function todayISO(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

const formSchema = z.object({
  accountId: z.string().min(1, "Pick an account"),
  direction: z.enum(["expense", "income"]),
  amount: z.string().refine((v) => Number(v) > 0, "Enter an amount"),
  date: z.string().min(1, "Pick a date"),
  payeeName: z.string(),
  note: z.string(),
  status: z.enum(["pending", "cleared", "reconciled"]),
})

function TransactionFormBody({
  idPrefix,
  accounts,
  defaultValues,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  idPrefix: string
  accounts: Account[]
  defaultValues: TransactionFormValues
  submitLabel: string
  onSubmit: (values: TransactionFormValues) => Promise<void>
  onCancel: () => void
}) {
  const form = useForm({
    defaultValues,
    validators: { onSubmit: formSchema },
    onSubmit: async ({ value }) => {
      try {
        await onSubmit(value)
        onCancel()
      } catch {
        // the mutation surfaces the failure via toast; keep the form open.
      }
    },
  })

  return (
    <form
      className="flex min-h-0 flex-1 flex-col"
      onSubmit={(e) => {
        e.preventDefault()
        form.handleSubmit()
      }}
    >
      <FieldGroup className="gap-5 overflow-y-auto px-4 py-1 md:-mx-2 md:px-2">
        {/* Direction — sets the sign and colour of the amount */}
        <form.Field
          name="direction"
          children={(field) => (
            <div className="grid grid-cols-2 gap-2">
              {(["expense", "income"] as const).map((dir) => {
                const selected = field.state.value === dir
                const isIncome = dir === "income"
                return (
                  <button
                    key={dir}
                    type="button"
                    onClick={() => field.handleChange(dir)}
                    aria-pressed={selected}
                    className={cn(
                      "rounded-lg border px-3 py-2 text-sm font-medium capitalize transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                      selected
                        ? isIncome
                          ? "border-transparent bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                          : "border-transparent bg-muted text-foreground ring-2 ring-primary"
                        : "border-border text-muted-foreground hover:bg-accent",
                    )}
                  >
                    {dir}
                  </button>
                )
              })}
            </div>
          )}
        />

        {/* Amount — prefixed with the selected account's currency symbol */}
        <form.Field
          name="amount"
          children={(field) => {
            const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid
            return (
              <Field data-invalid={isInvalid}>
                <FieldLabel htmlFor={`${idPrefix}-amount`}>Amount</FieldLabel>
                <div className="relative">
                  <form.Subscribe selector={(s) => s.values.accountId}>
                    {(accountId) => {
                      const acc = accounts.find((a) => a.id === accountId)
                      const code = acc ? toCurrencyCode(acc.currency) : undefined
                      return (
                        <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted-foreground tabular-nums">
                          {code ? getSymbol(code) : ""}
                        </span>
                      )
                    }}
                  </form.Subscribe>
                  <Input
                    id={`${idPrefix}-amount`}
                    name={field.name}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    aria-invalid={isInvalid}
                    inputMode="decimal"
                    placeholder="0.00"
                    autoComplete="off"
                    className="pl-13 text-right tabular-nums"
                  />
                </div>
                {isInvalid && <FieldError errors={field.state.meta.errors} />}
              </Field>
            )
          }}
        />

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          {/* Account */}
          <form.Field
            name="accountId"
            children={(field) => {
              const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid
              return (
                <Field data-invalid={isInvalid}>
                  <FieldLabel htmlFor={`${idPrefix}-account`}>Account</FieldLabel>
                  <Select value={field.state.value} onValueChange={field.handleChange}>
                    <SelectTrigger id={`${idPrefix}-account`} className="w-full">
                      <SelectValue placeholder="Select account" />
                    </SelectTrigger>
                    <SelectContent>
                      {accounts.map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.name}
                          <span className="text-muted-foreground">{a.currency}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {isInvalid && <FieldError errors={field.state.meta.errors} />}
                </Field>
              )
            }}
          />

          {/* Date */}
          <form.Field
            name="date"
            children={(field) => {
              const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid
              return (
                <Field data-invalid={isInvalid}>
                  <FieldLabel htmlFor={`${idPrefix}-date`}>Date</FieldLabel>
                  <Input
                    id={`${idPrefix}-date`}
                    name={field.name}
                    type="date"
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    aria-invalid={isInvalid}
                  />
                  {isInvalid && <FieldError errors={field.state.meta.errors} />}
                </Field>
              )
            }}
          />
        </div>

        {/* Payee */}
        <form.Field
          name="payeeName"
          children={(field) => (
            <Field>
              <FieldLabel htmlFor={`${idPrefix}-payee`}>Payee</FieldLabel>
              <Input
                id={`${idPrefix}-payee`}
                name={field.name}
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
                placeholder="e.g. Whole Foods"
                autoComplete="off"
              />
            </Field>
          )}
        />

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          {/* Status */}
          <form.Field
            name="status"
            children={(field) => (
              <Field>
                <FieldLabel htmlFor={`${idPrefix}-status`}>Status</FieldLabel>
                <Select
                  value={field.state.value}
                  onValueChange={(v) => field.handleChange(v as TxnStatus)}
                >
                  <SelectTrigger id={`${idPrefix}-status`} className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUSES.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            )}
          />
        </div>

        {/* Note */}
        <form.Field
          name="note"
          children={(field) => (
            <Field>
              <FieldLabel htmlFor={`${idPrefix}-note`}>Note</FieldLabel>
              <Textarea
                id={`${idPrefix}-note`}
                name={field.name}
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
                placeholder="Optional details"
                rows={2}
              />
            </Field>
          )}
        />
      </FieldGroup>

      <div className="mt-auto flex flex-col-reverse gap-2 px-4 py-4 sm:flex-row sm:justify-end sm:px-0 sm:pb-0">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <form.Subscribe selector={(s) => s.isSubmitting}>
          {(isSubmitting) => (
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? <Spinner /> : submitLabel}
            </Button>
          )}
        </form.Subscribe>
      </div>
    </form>
  )
}

/**
 * Responsive transaction form modal — Dialog on desktop, Drawer on mobile — shared
 * by create and edit. The caller supplies copy, the account list, initial values,
 * and a submit handler that should throw on failure so the modal stays open.
 */
export function TransactionFormModal({
  title,
  description,
  submitLabel,
  accounts,
  defaultValues,
  onSubmit,
  trigger,
}: {
  title: string
  description: string
  submitLabel: string
  accounts: Account[]
  defaultValues: TransactionFormValues
  onSubmit: (values: TransactionFormValues) => Promise<void>
  trigger: React.ReactNode
}) {
  const isMobile = useIsMobile()
  const [open, setOpen] = React.useState(false)

  const body = (
    <TransactionFormBody
      idPrefix={isMobile ? "m" : "d"}
      accounts={accounts}
      defaultValues={defaultValues}
      submitLabel={submitLabel}
      onSubmit={onSubmit}
      onCancel={() => setOpen(false)}
    />
  )

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerTrigger asChild>{trigger}</DrawerTrigger>
        <DrawerContent className="max-h-[92vh]">
          <DrawerHeader className="text-left">
            <DrawerTitle>{title}</DrawerTitle>
            <DrawerDescription>{description}</DrawerDescription>
          </DrawerHeader>
          {body}
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="gap-5 sm:max-w-[540px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {body}
      </DialogContent>
    </Dialog>
  )
}
