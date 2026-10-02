import { BellRing, CheckCircle2, ChevronDown, Eye, FileSignature, FileText, MoreHorizontal, PackageCheck, UserCheck } from "lucide-react";
import { Bouton, ItemMenu, LienBouton, MenuDeroulant, useMediaQuery } from "../ui";
import { classesBouton } from "../ui/Bouton";
import "../../styles/dossier.css";

interface ProprietesActionsDossier {
  /** Le dossier peut être marqué complet (reçu, notifié, en attente de complément). */
  peutValider: boolean;
  /** Champs obligatoires manquants : le bouton reste visible mais désactivé, avec l'explication en infobulle. */
  explicationValidationBloquee?: string;
  onValider: () => void;
  /** Aperçu PDF de l'acte (statut "complet"). */
  peutApercevoir: boolean;
  apercuEnCours: boolean;
  onApercu: () => void;
  /** Émission de l'acte (agent, statut "complet"). */
  peutEmettre: boolean;
  onEmettre: () => void;
  /** Lien vers le PDF de l'acte émis. */
  lienActe?: string;
  /** Remise de l'acte au déclarant (agent, acte émis non retiré) : devient l'action principale. */
  peutRemettre?: boolean;
  /** Hors ligne : la remise exige le serveur, le bouton est grisé avec son explication. */
  remiseIndisponible?: string;
  onRemettre?: () => void;
  /** Consultation du signataire (acte émis avec signataire connu). */
  peutVoirSignataire: boolean;
  signataireEnCours: boolean;
  onSignataire: () => void;
  peutRelancer: boolean;
  relanceEnCours: boolean;
  onRelancer: () => void;
  /** Masque la barre fixe mobile (la barre d'enregistrement prend la place). */
  masquerMobile: boolean;
}

/**
 * Actions du dossier, hiérarchisées : UNE action principale (selon le statut),
 * les actions courantes à côté sur grand écran, le reste dans "Plus d'actions".
 * Sous 720px, le groupe devient une barre fixe en bas de l'écran (accessible
 * au pouce) : action principale + menu seulement.
 */
export default function ActionsDossier(p: ProprietesActionsDossier) {
  const mobile = useMediaQuery("(max-width: 720px)");

  const principale = p.peutValider ? (
    <Bouton
      onClick={p.onValider}
      disabled={!!p.explicationValidationBloquee}
      title={p.explicationValidationBloquee}
      iconeGauche={<CheckCircle2 size={16} />}
    >
      Marquer comme complet
    </Bouton>
  ) : p.peutEmettre ? (
    <Bouton onClick={p.onEmettre} iconeGauche={<FileSignature size={16} />}>
      Émettre l'acte
    </Bouton>
  ) : p.peutRemettre ? (
    <Bouton onClick={p.onRemettre} disabled={!!p.remiseIndisponible} title={p.remiseIndisponible} iconeGauche={<PackageCheck size={16} />}>
      Remettre l'acte
    </Bouton>
  ) : p.lienActe ? (
    <LienBouton to={p.lienActe} iconeGauche={<FileText size={16} />}>
      Voir le PDF de l'acte
    </LienBouton>
  ) : p.peutApercevoir ? (
    <Bouton onClick={p.onApercu} chargement={p.apercuEnCours} iconeGauche={<Eye size={16} />}>
      Aperçu de l'acte
    </Bouton>
  ) : null;

  // L'aperçu est secondaire dès qu'une autre action est principale (sinon il est lui-même le bouton principal).
  const apercuSecondaire = p.peutApercevoir && (p.peutValider || p.peutEmettre || !!p.lienActe);
  // Quand « Remettre l'acte » est l'action principale, le PDF reste à portée de main en secondaire.
  const pdfSecondaire = !!p.peutRemettre && !!p.lienActe;

  const elementsMenu = [
    mobile && pdfSecondaire && (
      <ItemMenu key="pdf" icone={FileText} vers={p.lienActe}>
        Voir le PDF de l'acte
      </ItemMenu>
    ),
    mobile && apercuSecondaire && (
      <ItemMenu key="apercu" icone={Eye} onClick={p.onApercu} desactive={p.apercuEnCours}>
        Aperçu de l'acte
      </ItemMenu>
    ),
    p.peutVoirSignataire && (
      <ItemMenu key="signataire" icone={UserCheck} onClick={p.onSignataire} desactive={p.signataireEnCours}>
        Voir le signataire
      </ItemMenu>
    ),
    p.peutRelancer && (
      <ItemMenu key="relance" icone={BellRing} onClick={p.onRelancer} desactive={p.relanceEnCours}>
        Relancer le déclarant
      </ItemMenu>
    )
  ].filter(Boolean);

  if (!principale && elementsMenu.length === 0) return null;

  return (
    <div className={`eva-dd-actions${p.masquerMobile ? " eva-dd-actions--masquee-mobile" : ""}`}>
      {!mobile && pdfSecondaire && (
        <LienBouton to={p.lienActe as string} variante="secondaire" iconeGauche={<FileText size={16} />}>
          Voir le PDF de l'acte
        </LienBouton>
      )}
      {!mobile && apercuSecondaire && (
        <Bouton variante="secondaire" onClick={p.onApercu} chargement={p.apercuEnCours} iconeGauche={<Eye size={16} />}>
          Aperçu de l'acte
        </Bouton>
      )}
      {principale && <div className="eva-dd-actions__principale">{principale}</div>}
      {elementsMenu.length > 0 && (
        <MenuDeroulant
          ariaLabel="Plus d'actions sur ce dossier"
          classeDeclencheur={classesBouton("secondaire", "moyen", { iconeSeule: mobile })}
          declencheur={
            mobile ? (
              <MoreHorizontal size={18} />
            ) : (
              <>
                Plus d'actions <ChevronDown size={15} />
              </>
            )
          }
        >
          {elementsMenu}
        </MenuDeroulant>
      )}
    </div>
  );
}
