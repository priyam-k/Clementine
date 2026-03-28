"use client";

interface ProgressBarProps {
  value: number;
  color?: "primary" | "red" | "green";
  height?: "sm" | "md" | "lg";
  showLabel?: boolean;
  animated?: boolean;
}

export function ProgressBar({
  value,
  color = "primary",
  height = "sm",
  showLabel = false,
  animated = false,
}: ProgressBarProps) {
  const colorClass = {
    primary: "bg-[#EF8354]",
    red: "bg-[#6f0600]",
    green: "bg-green-600",
  }[color];

  const heightClass = { sm: "h-1.5", md: "h-2", lg: "h-3" }[height];

  return (
    <div className="w-full">
      {showLabel && (
        <div className="flex justify-between items-end mb-1">
          <span className="text-[10px] font-black uppercase tracking-widest text-[#4A3935]/60 font-[Inter,sans-serif]">
            Progress
          </span>
          <span className="text-sm font-black text-[#EF8354]">{value}%</span>
        </div>
      )}
      <div className={`w-full ${heightClass} bg-[#EDE7E3] rounded-full overflow-hidden`}>
        <div
          className={`${heightClass} ${colorClass} rounded-full transition-all duration-700 ease-out ${animated ? "harvest-meter-fill" : ""}`}
          style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
        />
      </div>
    </div>
  );
}
