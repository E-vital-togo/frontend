import type { ReactNode } from "react";

export type VarianteBadge = "neutre" | "succes" | "danger" | "attente" | "info";

export default function Badge({ variante = "neutre", children }: { variante?: VarianteBadge; children: ReactNode }) {
  return <span className={`eva-badge eva-badge--${variante}`}>{children}</span>;
}
