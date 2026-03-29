"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, ListTodo, Users, QrCode, Leaf } from "lucide-react";

interface SidebarProps {
  workerCountLabel?: string;
  taskCountLabel?: string;
  greenScore?: number;
}

export function Sidebar({ workerCountLabel, taskCountLabel, greenScore }: SidebarProps) {
  const pathname = usePathname();
  const navItems = [
    { path: "/host", label: "Dashboard", icon: LayoutDashboard, exact: true },
    {
      path: "/host/workers",
      label: "Workers",
      icon: Users,
      exact: false,
      countLabel: workerCountLabel,
    },
    {
      path: "/host/tasks",
      label: "Task Queue",
      icon: ListTodo,
      exact: false,
      countLabel: taskCountLabel,
    },
  ];

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
              <span className="flex-1">{item.label}</span>
              {item.countLabel ? (
                <span className="text-[9px] font-black tracking-widest text-inherit/70">
                  {item.countLabel}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>

      {/* Green Score */}
      {greenScore !== undefined && (
        <div className="mb-2 rounded-sm border border-[#120B09]/5 bg-white px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <Leaf size={11} className="text-green-700" />
              <p className="text-[9px] font-black uppercase tracking-widest text-[#4A3935]/50 font-[Inter,sans-serif]">
                Green Score
              </p>
            </div>
            <span
              className="text-lg font-black tracking-tighter"
              style={{
                color: greenScore >= 70 ? "#2D6A4F" : greenScore >= 40 ? "#EF8354" : "#BA1A1A",
              }}
            >
              {greenScore}
            </span>
          </div>
          <div className="h-1 bg-[#EDE7E3] rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${greenScore}%`,
                background: greenScore >= 70 ? "#2D6A4F" : greenScore >= 40 ? "#EF8354" : "#BA1A1A",
              }}
            />
          </div>
        </div>
      )}

      {/* Join CTA */}
      <Link
        href="/join"
        className="flex items-center justify-center gap-2 w-full py-4 bg-[#120B09] text-white font-black text-[10px] uppercase tracking-widest hover:bg-[#EF8354] transition-all rounded-sm font-[Inter,sans-serif]"
      >
        <QrCode size={13} />
        Join as Worker
      </Link>
    </aside>
  );
}
