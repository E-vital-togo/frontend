import type { ReactNode } from "react";
import { ChevronDown, MoreHorizontal } from "lucide-react";
import { MenuDeroulant, useMediaQuery } from "../../components/ui";

interface ProprietesMenuActionsLigne {
  /** Nom accessible du menu (ex: "Actions pour Awa Koné"). */
  ariaLabel: string;
  children: ReactNode;
}

/**
 * Menu d'actions secondaires d'une ligne : simple "..." sur desktop, bouton
 * "Actions" libellé dans les fiches mobiles (pied de fiche explicite).
 */
export default function MenuActionsLigne({ ariaLabel, children }: ProprietesMenuActionsLigne) {
  const mobile = useMediaQuery("(max-width: 720px)");
  if (mobile) {
    return (
      <MenuDeroulant
        ariaLabel={ariaLabel}
        classeDeclencheur="eva-bouton eva-bouton--secondaire eva-bouton--petit"
        declencheur={
          <>
            Actions <ChevronDown size={14} aria-hidden="true" />
          </>
        }
      >
        {children}
      </MenuDeroulant>
    );
  }
  return (
    <MenuDeroulant ariaLabel={ariaLabel} declencheur={<MoreHorizontal size={16} />}>
      {children}
    </MenuDeroulant>
  );
}
