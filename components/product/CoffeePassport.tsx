import { Mountain, Leaf, Flame, Package, Coffee, Award } from "lucide-react"

interface Props {
  elevationMin: number | null
  elevationMax: number | null
  harvestDate: Date | null
  roastedAt: Date | null
  batchId: string | null
  tasterNotes: string | null
  cupper: string | null
  sca: number | null
}

/**
 * «Паспорт зерна» — premium-сигналы доверия для specialty-кофе.
 * Рендерится на странице товара если хотя бы одно из полей заполнено.
 * Каждое поле опционально (обычно заполнено 2-4 из 8).
 */
export function CoffeePassport({
  elevationMin,
  elevationMax,
  harvestDate,
  roastedAt,
  batchId,
  tasterNotes,
  cupper,
  sca,
}: Props) {
  const hasAny =
    elevationMin !== null ||
    elevationMax !== null ||
    harvestDate !== null ||
    roastedAt !== null ||
    batchId !== null ||
    tasterNotes !== null ||
    cupper !== null ||
    sca !== null

  if (!hasAny) return null

  const elevationText =
    elevationMin !== null && elevationMax !== null && elevationMin !== elevationMax
      ? `${elevationMin}–${elevationMax} м`
      : elevationMin !== null
        ? `${elevationMin} м`
        : elevationMax !== null
          ? `${elevationMax} м`
          : null

  // «Обжарено N дней назад» — самое сильное сигнал «свежего кофе».
  let roastedText: string | null = null
  if (roastedAt) {
    const days = Math.floor((Date.now() - new Date(roastedAt).getTime()) / 86_400_000)
    if (days <= 0) roastedText = "сегодня"
    else if (days === 1) roastedText = "вчера"
    else if (days < 7) roastedText = `${days} ${days < 5 ? "дня" : "дней"} назад`
    else if (days < 30)
      roastedText = `${Math.floor(days / 7)} нед. назад`
    else roastedText = new Date(roastedAt).toLocaleDateString("ru-RU")
  }

  const harvestText = harvestDate
    ? new Date(harvestDate).toLocaleDateString("ru-RU", {
        month: "long",
        year: "numeric",
      })
    : null

  return (
    <section className="bg-secondary/30 border border-border rounded-2xl p-5 sm:p-6">
      <h3 className="font-sans text-lg sm:text-xl font-bold mb-4 flex items-center gap-2">
        <Coffee className="w-5 h-5 text-primary" />
        Паспорт зерна
      </h3>
      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
        {roastedText && (
          <PassportRow icon={Flame} label="Обжарено" value={roastedText} highlight />
        )}
        {elevationText && (
          <PassportRow icon={Mountain} label="Высота произрастания" value={elevationText} />
        )}
        {harvestText && (
          <PassportRow icon={Leaf} label="Урожай" value={harvestText} />
        )}
        {batchId && (
          <PassportRow icon={Package} label="Партия" value={batchId} mono />
        )}
        {sca !== null && (
          <PassportRow
            icon={Award}
            label="SCA score"
            value={`${sca}/100${sca >= 80 ? " · Specialty" : ""}`}
            highlight={sca >= 80}
          />
        )}
        {cupper && (
          <PassportRow icon={Coffee} label="Куппер" value={cupper} />
        )}
      </dl>
      {tasterNotes && (
        <div className="mt-4 pt-4 border-t border-border">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
            Заметки куппера
          </p>
          <p className="text-sm italic text-foreground/80 leading-relaxed">{tasterNotes}</p>
        </div>
      )}
    </section>
  )
}

function PassportRow({
  icon: Icon,
  label,
  value,
  highlight,
  mono,
}: {
  icon: typeof Mountain
  label: string
  value: string
  highlight?: boolean
  mono?: boolean
}) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon
        className={`w-4 h-4 mt-0.5 shrink-0 ${highlight ? "text-primary" : "text-muted-foreground"}`}
      />
      <div className="min-w-0">
        <dt className="text-xs text-muted-foreground">{label}</dt>
        <dd className={`font-medium ${highlight ? "text-primary" : ""} ${mono ? "font-mono text-xs" : ""}`}>
          {value}
        </dd>
      </div>
    </div>
  )
}
