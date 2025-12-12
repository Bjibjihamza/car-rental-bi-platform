export function Badge({ tone, children }: { tone: "green" | "blue" | "amber" | "red" | "gray"; children: React.ReactNode }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}
