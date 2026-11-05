const STYLES: Record<string, string> = {
  placed: "bg-accent text-accent-foreground",
  accepted: "bg-secondary text-secondary-foreground",
  preparing: "bg-secondary text-secondary-foreground",
  ready: "bg-primary text-primary-foreground",
  out_for_delivery: "bg-primary text-primary-foreground",
  delivered: "bg-success text-success-foreground",
  completed: "bg-success text-success-foreground",
  cancelled: "bg-destructive text-destructive-foreground",
  pending: "bg-accent text-accent-foreground",
  approved: "bg-success text-success-foreground",
  rejected: "bg-destructive text-destructive-foreground",
  suspended: "bg-muted text-muted-foreground",
  open: "bg-accent text-accent-foreground",
  resolved: "bg-success text-success-foreground",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${STYLES[status] ?? "bg-muted"}`}>
      {status.replace(/_/g, " ")}
    </span>
  );
}
