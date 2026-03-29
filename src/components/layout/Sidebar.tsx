"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, ListTodo, Users, QrCode } from "lucide-react";

interface SidebarProps {
  workerCountLabel?: string;
  taskCountLabel?: string;
  greenScore?: number;
}

// Interpolates blue → teal → green based on score (10–100)
function scoreColor(score: number): string {
  const t = Math.max(0, Math.min(1, (score - 10) / 90));
  const h = Math.round(215 - 70 * t); // 215 blue → 145 green
  const s = Math.round(80 - 20 * t);  // 80% → 60%
  const l = Math.round(45 - 13 * t);  // 45% → 32%
  return `hsl(${h}, ${s}%, ${l}%)`;
}

// Simple SVG tree that withers at low scores.
// t=0 → bare branches, t=1 → full lush canopy.
function WiltingTree({ score }: { score: number }) {
  const t = Math.max(0, Math.min(1, (score - 10) / 90));
  const color = scoreColor(score);

  // Canopy fills in as score rises: two layered circles
  const topR = 5 + t * 13;
  const midR = 3 + t * 16;
  const canopyOpacity = 0.12 + t * 0.78;

  // Bare branches fade out as canopy fills
  const branchOpacity = Math.max(0, 1 - t * 2.2);

  // Clementines: all inside the canopy, spread so none are adjacent.
  // Positions chosen so min distance between any pair is ~9 viewBox units.
  // Stem goes upward from each fruit, suggesting it hangs from a hidden branch.
  const ct = Math.max(0, Math.min(1, (score - 80) / 20));
  const clementineR = ct * 3.2;
  const clementines = [
    { cx: 15, cy: 19 }, // upper-left
    { cx: 35, cy: 15 }, // upper-right
    { cx: 19, cy: 31 }, // lower-left
    { cx: 33, cy: 28 }, // lower-right
    { cx: 27, cy: 21 }, // centre
  ];

  return (
    <svg
      width="104"
      height="118"
      viewBox="0 -5 52 59"
      className="mx-auto"
      style={{ transition: "all 0.7s ease" }}
    >
      {/* Trunk */}
      <rect x="23" y="38" width="6" height="14" rx="2" fill="#7B4F2E" opacity={0.7 + t * 0.3} />

      {/* Bare branches — visible when score is low */}
      <line x1="26" y1="32" x2="13" y2="22" stroke="#7B4F2E" strokeWidth="2.5" strokeLinecap="round" opacity={branchOpacity} />
      <line x1="26" y1="32" x2="39" y2="22" stroke="#7B4F2E" strokeWidth="2.5" strokeLinecap="round" opacity={branchOpacity} />
      <line x1="26" y1="26" x2="17" y2="17" stroke="#7B4F2E" strokeWidth="2"   strokeLinecap="round" opacity={branchOpacity * 0.8} />
      <line x1="26" y1="26" x2="35" y2="17" stroke="#7B4F2E" strokeWidth="2"   strokeLinecap="round" opacity={branchOpacity * 0.8} />
      <line x1="26" y1="30" x2="26" y2="18" stroke="#7B4F2E" strokeWidth="2"   strokeLinecap="round" opacity={branchOpacity * 0.9} />

      {/* Mid canopy blob */}
      <circle cx="26" cy="26" r={midR} fill={color} opacity={canopyOpacity} style={{ transition: "all 0.7s ease" }} />
      {/* Crown */}
      <circle cx="26" cy="16" r={topR} fill={color} opacity={canopyOpacity * 0.85} style={{ transition: "all 0.7s ease" }} />

      {/* Clementines — hang off canopy edge above score 80 */}
      {clementines.map((pos, i) => (
        <g key={i} style={{ transition: "all 0.7s ease" }} opacity={ct * 0.95}>
          {/* Tiny stem */}
          <line
            x1={pos.cx} y1={pos.cy - clementineR}
            x2={pos.cx} y2={pos.cy - clementineR - 2}
            stroke="#5C3D2E"
            strokeWidth="0.8"
            strokeLinecap="round"
          />
          {/* Fruit */}
          <circle cx={pos.cx} cy={pos.cy} r={clementineR} fill="#EF8354" />
        </g>
      ))}
    </svg>
  );
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
        <div className="mb-3 flex flex-col items-center text-center" style={{ transition: "all 0.7s ease" }}>
          <WiltingTree score={greenScore} />
          <p
            className="text-4xl font-black tracking-tighter leading-none mt-1"
            style={{ color: scoreColor(greenScore), transition: "color 0.7s ease" }}
          >
            {greenScore}
          </p>
          <p
            className="text-[9px] font-black uppercase tracking-[0.25em] mt-1 font-[Inter,sans-serif]"
            style={{ color: scoreColor(greenScore), transition: "color 0.7s ease", opacity: 0.7 }}
          >
            Green Score
          </p>
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
