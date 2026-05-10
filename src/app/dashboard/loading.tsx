export default function DashboardLoading() {
  return (
    <div className="dashboard-page" aria-label="Loading workspace">
      <section className="dashboard-hero">
        <div>
          <div className="loading-shimmer h-7 w-44 rounded-full" />
          <div className="loading-shimmer mt-5 h-9 w-full max-w-md rounded-[var(--radius-sm)]" />
          <div className="loading-shimmer mt-3 h-4 w-full max-w-xl rounded-full" />
        </div>
        <div className="dashboard-hero-actions">
          <div className="loading-shimmer h-11 w-32 rounded-[var(--radius-sm)]" />
          <div className="loading-shimmer h-11 w-32 rounded-[var(--radius-sm)]" />
        </div>
      </section>

      <div className="dashboard-stat-grid">
        {[0, 1, 2, 3].map((item) => (
          <div key={item} className="stat-card loading-shimmer" />
        ))}
      </div>

      <div className="dashboard-section-grid">
        <section className="card">
          <div className="loading-shimmer h-5 w-48 rounded-full" />
          <div className="loading-shimmer mt-4 h-[220px] rounded-[var(--radius-md)]" />
        </section>
        <section className="card">
          <div className="loading-shimmer h-5 w-40 rounded-full" />
          <div className="mt-5 grid gap-3">
            {[0, 1, 2].map((item) => (
              <div key={item} className="loading-shimmer h-14 rounded-[var(--radius-sm)]" />
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
