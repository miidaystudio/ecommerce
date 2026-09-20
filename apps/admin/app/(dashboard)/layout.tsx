import { Sidebar } from '../../components/layout/Sidebar';
import { Topbar } from '../../components/layout/Topbar';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-screen w-screen overflow-hidden flex bg-[#F8F7F4] font-sans">
      <Sidebar />
      <div className="flex-1 h-full overflow-hidden flex flex-col">
        <Topbar />
        <main className="flex-1 overflow-y-auto p-8 space-y-6 scrollbar-thin">{children}</main>
      </div>
    </div>
  );
}
