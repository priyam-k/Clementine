"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, ListTodo, Users, QrCode, Settings, Zap } from "lucide-react";

const navItems = [
  { path: "/host", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { path: "/host/workers", label: "Workers", icon: Users, exact: false },
  { path: "/host/tasks", label: "Task Queue", icon: ListTodo, exact: false },
];

export function Sidebar() {
  const pathname = usePathname();

  const isActive = (item: (typeof navItems)[number]) => {
    if (item.exact) return pathname === item.path;
    return pathname === item.path.split("#")[0];
  };

  return (
    <aside className="hidden md:flex flex-col h-screen w-64 fixed left-0 top-0 z-50 bg-[#f8f3f0]/90 backdrop-blur-sm border-r border-[#120B09]/5 p-6 gap-2">
      {/* Wordmark */}
      <Link href="/" className="mb-10 block group">
        <h1 className="text-2xl font-black text-[#6f0600] tracking-tighter uppercase italic leading-none">Clementine</h1>
        <p className="text-[9px] uppercase tracking-[0.25em] text-[#120B09]/40 font-bold font-[Inter,sans-serif] mt-0.5">Distributed Computing</p>
      </Link>

      {/* Nav */}
      <nav className="flex flex-col gap-1 flex-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item);
          return (
            <Link
              key={item.label}
              href={item.path}
              className={`flex items-center gap-3 px-4 py-3 transition-all font-[Inter,sans-serif] text-[11px] font-bold uppercase tracking-wider rounded-sm ${
                active
                  ? "bg-white text-[#EF8354] shadow-sm border border-[#120B09]/5"
                  : "text-[#120B09]/50 hover:bg-[#F5F1EE] hover:text-[#120B09]"
              }`}
            >
              <Icon size={15} strokeWidth={active ? 2.5 : 2} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Join CTA */}
      <Link
        href="/join"
        className="flex items-center justify-center gap-2 w-full py-4 bg-[#120B09] text-white font-black text-[10px] uppercase tracking-widest hover:bg-[#EF8354] transition-all rounded-sm font-[Inter,sans-serif]"
      >
        <QrCode size={13} />
        Join as Worker
      </Link>

      {/* Bottom */}
      <div className="flex flex-col gap-1 border-t border-[#120B09]/5 pt-4 mt-2">
        <Link
          href="/host"
          className="flex items-center gap-3 px-4 py-3 text-[#120B09]/40 hover:bg-[#F5F1EE] hover:text-[#120B09] font-[Inter,sans-serif] text-[11px] font-bold uppercase tracking-wider rounded-sm transition-all"
        >
          <Zap size={14} />
          <span>Orchestrate</span>
        </Link>
        <a href="#" className="flex items-center gap-3 px-4 py-3 text-[#120B09]/40 hover:bg-[#F5F1EE] hover:text-[#120B09] font-[Inter,sans-serif] text-[11px] font-bold uppercase tracking-wider rounded-sm transition-all">
          <Settings size={14} />
          <span>Settings</span>
        </a>
      </div>
    </aside>
  );
}
