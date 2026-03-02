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
            className="px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium"
          >
            {note}
          </span>
        ))}
      </div>
    </div>
  )
}
