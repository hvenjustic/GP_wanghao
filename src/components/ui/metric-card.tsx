type MetricCardProps = {
  label: string;
  value: string;
  hint: string;
};

export function MetricCard({ label, value, hint }: MetricCardProps) {
  return (
    <article className="surface-card">
      <span className="eyebrow">{label}</span>
      <div className="metric-value">{value}</div>
      <p>{hint}</p>
    </article>
  );
}
