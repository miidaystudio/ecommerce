export default function DashboardPage() {
  return (
    <div className="flex flex-col gap-3">
      <span className="w-fit rounded-md bg-surface px-3 py-1 text-sm text-text-secondary">
        Phase 1 · Auth & user management
      </span>
      <h1 className="text-3xl font-bold text-text-primary">Dashboard</h1>
      <p className="max-w-prose text-base text-text-secondary">
        You are signed in as an admin. Product, order, and inventory management screens arrive in
        later phases.
      </p>
    </div>
  );
}
