import type { ReactNode } from "react";

export interface ElementFrise {
  id: string;
  date: string;
  contenu: ReactNode;
}

export default function Frise({ elements }: { elements: ElementFrise[] }) {
  return (
    <div className="eva-frise">
      {elements.map((el) => (
        <div className="eva-frise__item" key={el.id}>
          <span className="eva-frise__point" />
          <div className="eva-frise__date texte-mono">{el.date}</div>
          <div className="eva-frise__contenu">{el.contenu}</div>
        </div>
      ))}
    </div>
  );
}
