import * as React from "react"
import { useForm } from "@tanstack/react-form"
import * as z from "zod"

import { cn } from "@/lib/utils.ts"
import { ACCOUNT_TYPES, type AccountTypeValue } from "@/features/accounts/account-types"
import { useIsMobile } from "#/hooks/use-mobile.ts"
import { Button } from "@/components/ui/button.tsx"
import { Input } from "@/components/ui/input.tsx"
import { Spinner } from "@/components/ui/spinner"
import {
  Field,
  FieldDescription,
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
import { CURRENCY_CODES, currencyFlag, getSymbol, toCurrencyCode } from "#/lib/currency"

export type AccountFormValues = {
  name: string
  type: AccountTypeValue
  currency: string
  initialBalance: string
}

/** Store the balance text as integer minor units (the schema's `bigint`). "12.50" → 1250. */
export function toMinorUnits(input: string): number {
  if (!input.trim()) return 0
  return Math.round(Number(input) * 100)
}

/** Inverse of {@link toMinorUnits} for prefilling the edit form. 1250 → "12.50". */
export function fromMinorUnits(minorUnits: number): string {
  return (minorUnits / 100).toFixed(2)
}

/** Country flag for a currency, sized to sit inline with its code. Falls back to a
 *  neutral chip for supranational codes and metals that have no national flag. */
function CurrencyFlag({ code }: { code: string }) {
  const flag = currencyFlag(code)
  if (!flag) {
    return (
      <span
        aria-hidden
        className="inline-block h-[1em] w-[1.333em] shrink-0 rounded-[2px] bg-muted"
      />
    )
  }
  return (
    <span
      aria-hidden
      className={cn("fi shrink-0 rounded-[2px] shadow-[0_0_0_1px_rgb(0_0_0/0.06)]", `fi-${flag}`)}
    />
  )
}

const formSchema = z.object({
  name: z.string().trim().min(1, "Give the account a name"),
  type: z.enum(ACCOUNT_TYPES.map((t) => t.value) as [AccountTypeValue, ...AccountTypeValue[]]),
  currency: z.string().regex(/^[A-Z]{3}$/, "Pick a currency"),
  initialBalance: z
    .string()
    .refine((v) => v.trim() === "" || Number.isFinite(Number(v)), "Enter a valid amount"),
})

function AccountFormBody({
  idPrefix,
  defaultValues,
  submitLabel,
  currencyEditable,
  onSubmit,
  onCancel,
}: {
  idPrefix: string
  defaultValues: AccountFormValues
  submitLabel: string
  currencyEditable: boolean
  onSubmit: (values: AccountFormValues) => Promise<void>
  onCancel: () => void
}) {
  const form = useForm({
    defaultValues,
    validators: { onSubmit: formSchema },
    onSubmit: async ({ value }) => {
      try {
        await onSubmit(value)
        onCancel() // closes the modal on success
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
        <form.Field
          name="name"
          children={(field) => {
            const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid
            return (
              <Field data-invalid={isInvalid}>
                <FieldLabel htmlFor={`${idPrefix}-name`}>Account name</FieldLabel>
                <Input
                  id={`${idPrefix}-name`}
                  name={field.name}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  aria-invalid={isInvalid}
                  placeholder="e.g. Everyday Checking"
                  autoComplete="off"
                />
                {isInvalid && <FieldError errors={field.state.meta.errors} />}
              </Field>
            )
          }}
        />

        <form.Field
          name="type"
          children={(field) => (
            <Field>
              <FieldLabel>Type</FieldLabel>
              <div
                role="radiogroup"
                aria-label="Account type"
                className="grid grid-cols-2 gap-2 sm:grid-cols-3 "
              >
                {ACCOUNT_TYPES.map(({ value, label, icon: Icon, color }) => {
                  const selected = field.state.value === value
                  return (
                    <button
                      key={value}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => field.handleChange(value)}
                      className={cn(
                        "group flex items-center gap-2.5 rounded-lg border bg-card px-3 py-2.5 text-left transition-colors outline-none",
                        "hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50",
                        selected ? "bg-green-100" : "border-border",
                      )}
                    >
                      <span
                        className="flex size-8 shrink-0 items-center justify-center rounded-md"
                        style={{
                          color: selected ? "oklch(98.2% 0.018 155.826)" : `${color}`,
                          backgroundColor: selected ? "oklch(98.2% 0.018 155.826)" : `${color}1f`,
                        }}
                      >
                        <Icon className={cn("size-4", selected ? "text-stone-600" : color)} />
                      </span>
                      <span className="text-sm font-medium">{label}</span>
                    </button>
                  )
                })}
              </div>
            </Field>
          )}
        />

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <form.Field
            name="currency"
            children={(field) => (
              <Field>
                <FieldLabel htmlFor={`${idPrefix}-currency`}>Currency</FieldLabel>
                <Select
                  value={field.state.value}
                  onValueChange={field.handleChange}
                  disabled={!currencyEditable}
                >
                  <SelectTrigger id={`${idPrefix}-currency`} className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CURRENCY_CODES.map((code) => (
                      <SelectItem key={code} value={code}>
                        <CurrencyFlag code={code} />
                        {code}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {!currencyEditable && (
                  <FieldDescription>Currency can't be changed after creation.</FieldDescription>
                )}
              </Field>
            )}
          />

          <form.Field
            name="initialBalance"
            children={(field) => {
              const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid
              return (
                <Field data-invalid={isInvalid}>
                  <FieldLabel htmlFor={`${idPrefix}-balance`}>Opening balance</FieldLabel>
                  <div className="relative">
                    <form.Subscribe selector={(s) => s.values.currency}>
                      {(currency) => (
                        <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted-foreground tabular-nums">
                          {getSymbol(toCurrencyCode(currency)!)}
                        </span>
                      )}
                    </form.Subscribe>
                    <Input
                      id={`${idPrefix}-balance`}
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
        </div>
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
 * Responsive account form modal — a centered Dialog on desktop, a bottom Drawer on
 * touch/mobile, sharing one form body. Used by both create and edit; the caller
 * supplies the copy, the initial values, and the submit handler (which should throw
 * on failure so the modal stays open).
 */
export function AccountFormModal({
  title,
  description,
  submitLabel,
  defaultValues,
  currencyEditable = true,
  onSubmit,
  trigger,
}: {
  title: string
  description: string
  submitLabel: string
  defaultValues: AccountFormValues
  currencyEditable?: boolean
  onSubmit: (values: AccountFormValues) => Promise<void>
  trigger: React.ReactNode
}) {
  const isMobile = useIsMobile()
  const [open, setOpen] = React.useState(false)

  const body = (
    <AccountFormBody
      idPrefix={isMobile ? "m" : "d"}
      defaultValues={defaultValues}
      submitLabel={submitLabel}
      currencyEditable={currencyEditable}
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
