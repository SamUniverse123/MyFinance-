import {
  Landmark,
  PiggyBank,
  Banknote,
  CreditCard,
  HandCoins,
  TrendingUp,
  Shapes,
  type LucideIcon,
} from "lucide-react"

/* The 7 db enum values, each carrying the icon + colour we persist on the account.
   Shared so the create form and the accounts list render the same identity. */
export type AccountTypeValue =
  | "checking"
  | "savings"
  | "cash"
  | "credit_card"
  | "loan"
  | "investment"
  | "other"

export type AccountTypeMeta = {
  value: AccountTypeValue
  label: string
  icon: LucideIcon
  color: string
}

export const ACCOUNT_TYPES: AccountTypeMeta[] = [
  { value: "checking", label: "Checking", icon: Landmark, color: "#3b82f6" },
  { value: "savings", label: "Savings", icon: PiggyBank, color: "#10b981" },
  { value: "cash", label: "Cash", icon: Banknote, color: "#f59e0b" },
  { value: "credit_card", label: "Credit card", icon: CreditCard, color: "#8b5cf6" },
  { value: "loan", label: "Loan", icon: HandCoins, color: "#ef4444" },
  { value: "investment", label: "Investment", icon: TrendingUp, color: "#14b8a6" },
  { value: "other", label: "Other", icon: Shapes, color: "#64748b" },
]

const BY_VALUE = new Map(ACCOUNT_TYPES.map((t) => [t.value, t]))

/** Look up a type's icon/colour/label; falls back to "Other" for unknown values. */
export function getAccountTypeMeta(value: string): AccountTypeMeta {
  return BY_VALUE.get(value as AccountTypeValue) ?? ACCOUNT_TYPES[ACCOUNT_TYPES.length - 1]
}
