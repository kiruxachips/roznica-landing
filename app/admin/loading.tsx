export default function AdminLoading() {
  return (
    <div className="p-8">
      <div className="h-8 w-64 bg-muted rounded animate-pulse mb-6" />
      <div className="space-y-3">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="h-16 bg-muted/60 rounded-xl animate-pulse" />
        ))}
      </div>
    </div>
  )
}
