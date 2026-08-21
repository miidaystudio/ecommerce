export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col items-center justify-center gap-4 px-4 text-center">
      <span className="rounded-md bg-surface px-3 py-1 text-sm text-text-secondary">
        Phase 0 · Project setup
      </span>
      <h1 className="text-4xl font-bold text-text-primary">Storefront</h1>
      <p className="max-w-prose text-base text-text-secondary">
        Base layout and design tokens are wired up. Product browsing, cart, and checkout arrive in
        later phases.
      </p>
    </main>
  );
}
