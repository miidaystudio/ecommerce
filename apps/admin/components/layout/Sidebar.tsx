const NAV_ITEMS = [
  { label: 'Dashboard', href: '/' },
  { label: 'Products', href: '/products' },
  { label: 'Orders', href: '/orders' },
  { label: 'Customers', href: '/customers' },
];

export function Sidebar() {
  return (
    <aside className="hidden w-60 shrink-0 flex-col bg-admin-sidebar-bg px-4 py-6 text-admin-sidebar-text md:flex">
      <span className="text-lg font-semibold">Admin</span>
      <nav className="mt-6 flex flex-col gap-1">
        {NAV_ITEMS.map((item) => (
          <span
            key={item.href}
            className="rounded-md px-3 py-2 text-sm text-admin-sidebar-text/80"
          >
            {item.label}
          </span>
        ))}
      </nav>
      <p className="mt-auto text-xs text-admin-sidebar-text/50">
        Navigation activates as modules ship in later phases.
      </p>
    </aside>
  );
}
