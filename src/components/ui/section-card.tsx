import type { PropsWithChildren, ReactNode } from "react";

type SectionCardProps = PropsWithChildren<{
  eyebrow?: string;
  title: string;
  description?: string;
  extra?: ReactNode;
}>;

export function SectionCard({
  eyebrow,
  title,
  description,
  extra,
  children
}: SectionCardProps) {
  return (
    <section className="surface-card">
      {eyebrow ? <span className="eyebrow">{eyebrow}</span> : null}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 16
        }}
      >
        <div>
          <h2>{title}</h2>
          {description ? <p>{description}</p> : null}
        </div>
        {extra}
      </div>
      {children}
    </section>
  );
}
