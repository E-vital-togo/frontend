import type { HTMLAttributes, ReactNode } from "react";

interface ProprietesCarte extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export default function Carte({ children, className, ...reste }: ProprietesCarte) {
  return (
    <div className={["eva-carte", className].filter(Boolean).join(" ")} {...reste}>
      {children}
    </div>
  );
}
