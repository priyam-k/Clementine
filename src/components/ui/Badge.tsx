"use client";
import type { WorkerStatus, TaskStatus, JobStatus } from "@/lib/types";

type BadgeVariant = "primary" | "red" | "green" | "muted" | "outline";

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  className?: string;
}

export function Badge({ children, variant = "primary", className = "" }: BadgeProps) {
  const variantClasses: Record<BadgeVariant, string> = {
    primary: "bg-[#EF8354]/10 text-[#EF8354]",
    red: "bg-[#6f0600]/10 text-[#6f0600]",
    green: "bg-green-50 text-green-800 border border-green-200",
    muted: "bg-[#EDE7E3] text-[#4A3935]",
    outline: "border-2 border-[#EF8354] text-[#EF8354]",
  };

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 text-[10px] font-black uppercase tracking-widest rounded-full font-[Inter,sans-serif] ${variantClasses[variant]} ${className}`}
    >
      {children}
    </span>
  );
}

export function WorkerStatusBadge({ status }: { status: WorkerStatus }) {
  const map: Record<WorkerStatus, { label: string; variant: BadgeVariant }> = {
    idle: { label: "Idle", variant: "muted" },
    working: { label: "Working", variant: "primary" },
    done: { label: "Done", variant: "green" },
    offline: { label: "Offline", variant: "red" },
  };
  const { label, variant } = map[status];
  return <Badge variant={variant}>{label}</Badge>;
}

export function TaskStatusBadge({ status }: { status: TaskStatus }) {
  const map: Record<TaskStatus, { label: string; variant: BadgeVariant }> = {
    queued: { label: "Queued", variant: "muted" },
    assigned: { label: "Assigned", variant: "outline" },
    running: { label: "Running", variant: "primary" },
    completed: { label: "Completed", variant: "green" },
    failed: { label: "Failed", variant: "red" },
  };
  const { label, variant } = map[status];
  return <Badge variant={variant}>{label}</Badge>;
}

export function JobStatusBadge({ status }: { status: JobStatus }) {
  const map: Record<JobStatus, { label: string; variant: BadgeVariant }> = {
    queued: { label: "Queued", variant: "muted" },
    running: { label: "Running", variant: "primary" },
    completed: { label: "Completed", variant: "green" },
    failed: { label: "Failed", variant: "red" },
  };
  const { label, variant } = map[status];
  return <Badge variant={variant}>{label}</Badge>;
}
