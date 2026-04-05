import { Coffee } from "lucide-react"

export function FlavorNotes({ notes }: { notes: string[] }) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider mb-3">
        Вкусовые ноты
      </h3>
      <div className="flex flex-wrap gap-2">
        {notes.map((note) => (
          <span
            key={note}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-primary/8 text-primary text-sm font-medium border border-primary/15"
          >
            <Coffee className="w-3.5 h-3.5" />
            {note}
          </span>
        ))}
      </div>
    </div>
  )
}
