"use client"

interface Transaction {
  id: string
  amount: number
  type: string
  description: string
  orderId: string | null
  createdAt: Date
}

interface Props {
  transactions: Transaction[]
}

export function BonusHistory({ transactions }: Props) {
  if (transactions.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-8">
        История операций пуста
      </p>
    )
  }

  return (
    <div className="space-y-2">
      {transactions.map((tx) => (
        <div
          key={tx.id}
          className="flex items-center justify-between p-3 bg-white rounded-xl border border-border"
        >
          <div>
            <p className="text-sm font-medium">{tx.description}</p>
            <p className="text-xs text-muted-foreground">
              {new Date(tx.createdAt).toLocaleDateString("ru-RU", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </p>
          </div>
          <span
            className={`text-sm font-bold ${
              tx.amount > 0 ? "text-green-600" : "text-red-500"
            }`}
          >
            {tx.amount > 0 ? "+" : ""}{tx.amount}₽
          </span>
        </div>
      ))}
    </div>
  )
}
