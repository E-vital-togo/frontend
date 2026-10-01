import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { AlertTriangle, Bell, BellOff, CheckCircle2, ChevronDown, Clock, FileEdit, LogOut, Menu, RefreshCw, UserCircle2, X } from "lucide-react";
import Logo from "./Logo";
import Avatar from "./ui/Avatar";
import MenuDeroulant, { EnteteMenu, ItemMenu, SeparateurMenu } from "./ui/MenuDeroulant";
import { useMediaQuery } from "./ui/useMediaQuery";
import { useAuth } from "../context/AuthContext";
import { dossiersAvecActionsEnAttente, listerActionsEchouees, listerActionsEnAttente, purgerCacheExpire } from "../lib/db";
import { precacherFormulaires } from "../lib/formulairesHorsLigne";
import { synchroniser, surRetourConnexion } from "../lib/syncService";
import { useCompteurs } from "../lib/useCompteurs";
import { estEnLigne, useConnectivite } from "../lib/connectivite";
import type { LienNavigation, Role } from "../types/domaine";

interface ProprietesMiseEnPage {
  liens: LienNavigation[];
  children: ReactNode;
}

const CHEMIN_COMPTE = "/mon-compte";
const REQUETE_MOBILE = "(max-width: 900px)";

const LIBELLES_ROLE: Record<Role, string> = {
  agent_cec: "Agent d'état civil",
  admin_cec: "Administrateur CEC",
  admin_inseed: "Administrateur INSEED",
  admin_general: "Administrateur général"
};

function pluriel(nombre: number, singulier: string, plurielTexte: string): string {
  return `${nombre} ${nombre > 1 ? plurielTexte : singulier}`;
}

export default function MiseEnPage({ liens, children }: ProprietesMiseEnPage) {
  const { utilisateur, deconnecter } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const compteurs = useCompteurs();

  const [nombreEnAttente, setNombreEnAttente] = useState(0);
  const [nombreEchouees, setNombreEchouees] = useState(0);
  const enLigne = useConnectivite();
  const [enSynchronisation, setEnSynchronisation] = useState(false);
  const [barreOuverte, setBarreOuverte] = useState(false);
  const estMobile = useMediaQuery(REQUETE_MOBILE);
  // Un groupe s'ouvre par defaut si on est deja sur sa page (ex: arrivee
  // directe sur /admin-cec/dossiers) ; l'utilisateur peut ensuite le
  // deplier/replier librement, y compris pour consulter un autre groupe que
  // celui de la page courante. Recalcule a chaque montage de MiseEnPage
  // (donc a chaque changement de route, sauf changement de simple query
  // string au sein d'une meme page, ou l'etat "ouvert" doit justement
  // persister pendant qu'on bascule entre Naissance/Deces).
  const [groupesOuverts, setGroupesOuverts] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    liens.forEach((lien) => {
      if (lien.sousLiens) initial[lien.chemin] = location.pathname === lien.chemin;
    });
    return initial;
  });
  const refBoutonMenu = useRef<HTMLButtonElement>(null);
  const refNavigation = useRef<HTMLElement>(null);
  const refPrincipal = useRef<HTMLElement>(null);

  async function rafraichirCompteurSync() {
    const [actions, echouees] = await Promise.all([listerActionsEnAttente(), listerActionsEchouees()]);
    setNombreEnAttente(actions.length);
    setNombreEchouees(echouees.length);
  }

  useEffect(() => {
    rafraichirCompteurSync();
    // Ecarte les entrees de cache de plus de 24h (voir purgerCacheExpire :
    // les dossiers en attente de synchronisation sont epargnes).
    purgerCacheExpire().catch(() => {});

    async function tenterSynchronisation() {
      // Un echec de synchronisation ne doit jamais remonter en rejet non
      // gere : le reseau peut retomber en pleine requete, ou la session
      // avoir expire pendant la coupure (apiClient deconnecte alors
      // proprement de son cote). Dans tous les cas la file locale reste
      // intacte et sera rejouee au prochain retour de connexion.
      let dossiersSynchronises: string[] = [];
      setEnSynchronisation(true);
      try {
        dossiersSynchronises = [...(await dossiersAvecActionsEnAttente())];
        await synchroniser();
      } catch {
        // Silencieux ici : le compteur d'actions en attente ci-dessous
        // reste le signal visible pour l'agent.
      }
      // Le serveur vient de statuer sur ces dossiers : leur copie locale,
      // optimiste jusque-la, doit ceder la place a la version serveur -
      // sinon une saisie refusee pour conflit resterait affichee comme si
      // elle avait ete prise en compte.
      if (dossiersSynchronises.length > 0) {
        await precacherFormulaires(dossiersSynchronises, true).catch(() => {});
      }
      await rafraichirCompteurSync();
      setEnSynchronisation(false);
    }

    // surRetourConnexion ne reagit qu'a une transition hors-ligne -> en-ligne
    // (voir connectivite.ts, notifier() ne previent que sur un CHANGEMENT).
    // Si l'app demarre - ou que cet ecran se remonte au fil d'une navigation
    // - alors qu'elle est DEJA en ligne avec des actions encore en file
    // (l'agent avait ferme l'app hors-ligne, la rouvre plus tard une fois
    // reconnecte), il n'y a justement aucune transition a observer : sans
    // cet appel immediat, ces actions resteraient bloquees jusqu'a la
    // PROCHAINE vraie coupure/reconnexion, qui peut ne jamais survenir.
    if (estEnLigne()) {
      tenterSynchronisation();
    }

    const retirer = surRetourConnexion(tenterSynchronisation);

    return () => {
      retirer();
    };
  }, []);

  useEffect(() => {
    setBarreOuverte(false);
  }, [location.pathname]);

  // Tiroir mobile : Echap ferme, le defilement de la page est fige, le reste de la
  // page est rendu inerte, le focus entre dans le menu puis revient au bouton.
  useEffect(() => {
    if (!barreOuverte) return;
    const ouvertDepuis = refBoutonMenu.current;
    function surEchap(evenement: KeyboardEvent) {
      if (evenement.key === "Escape") setBarreOuverte(false);
    }
    document.addEventListener("keydown", surEchap);
    document.body.classList.add("eva-nav-ouverte");
    const principal = refPrincipal.current as (HTMLElement & { inert?: boolean }) | null;
    if (principal) principal.inert = true;
    refNavigation.current?.querySelector<HTMLElement>("a, button")?.focus();
    return () => {
      document.removeEventListener("keydown", surEchap);
      document.body.classList.remove("eva-nav-ouverte");
      if (principal) principal.inert = false;
      ouvertDepuis?.focus();
    };
  }, [barreOuverte]);

  // Passage en affichage large : le tiroir n'a plus lieu d'etre
  useEffect(() => {
    if (!estMobile) setBarreOuverte(false);
  }, [estMobile]);

  function seDeconnecter() {
    deconnecter();
    navigate("/connexion");
  }

  function basculerGroupe(chemin: string) {
    setGroupesOuverts((precedent) => ({ ...precedent, [chemin]: !precedent[chemin] }));
  }

  const totalNotifications =
    compteurs.echeances + compteurs.conflits + compteurs.demandes + compteurs.notificationsEchouees + nombreEchouees;

  const compteurParCle: Record<string, number> = {
    echeances: compteurs.echeances,
    echeancesNaissance: compteurs.echeancesNaissance,
    echeancesDeces: compteurs.echeancesDeces,
    conflits: compteurs.conflits,
    demandes: compteurs.demandes,
    demandesNaissance: compteurs.demandesNaissance,
    demandesDeces: compteurs.demandesDeces,
    notificationsEchouees: compteurs.notificationsEchouees,
    notificationsEchoueesNaissance: compteurs.notificationsEchoueesNaissance,
    notificationsEchoueesDeces: compteurs.notificationsEchoueesDeces,
    syncEchouees: nombreEchouees
  };

  const estAgent = utilisateur?.role === "agent_cec";
  const libelleConnexion = enSynchronisation ? "Synchronisation en cours" : enLigne ? "En ligne" : "Hors ligne";
  const indicateurSynchro = (
    <>
      {enSynchronisation ? <RefreshCw size={13} className="eva-statut-connexion__rotation" aria-hidden="true" /> : <span className="eva-statut-connexion__point" aria-hidden="true" />}
      <span className="eva-statut-connexion__libelle">{libelleConnexion}</span>
      {nombreEnAttente > 0 && (
        <span className="eva-statut-connexion__attente" title={`${pluriel(nombreEnAttente, "action en attente", "actions en attente")} de synchronisation`}>
          {nombreEnAttente}
          <span className="eva-sr-only"> {nombreEnAttente > 1 ? "actions en attente" : "action en attente"}</span>
        </span>
      )}
    </>
  );
  const classesSynchro = `eva-statut-connexion${enLigne ? "" : " eva-statut-connexion--hors-ligne"}${enSynchronisation ? " eva-statut-connexion--synchro" : ""}`;

  const notifications: Array<{ cle: string; vers: string; icone: typeof Clock; texte: string }> = [];
  if (compteurs.echeances > 0)
    notifications.push({
      cle: "echeances",
      vers: "/agent/dossiers?echeance=1",
      icone: Clock,
      texte: `${pluriel(compteurs.echeances, "dossier proche", "dossiers proches")} de l'échéance`
    });
  if (compteurs.conflits > 0)
    notifications.push({
      cle: "conflits",
      vers: utilisateur?.role === "admin_cec" ? "/admin-cec/conflits" : "/agent/conflits",
      icone: AlertTriangle,
      texte: pluriel(compteurs.conflits, "conflit de synchronisation", "conflits de synchronisation")
    });
  if (compteurs.notificationsEchouees > 0)
    notifications.push({
      cle: "notifications",
      vers: "/admin-cec/notifications-echouees",
      icone: BellOff,
      texte: pluriel(compteurs.notificationsEchouees, "notification en échec", "notifications en échec")
    });
  if (compteurs.demandes > 0)
    notifications.push({
      cle: "demandes",
      vers: "/admin-cec/demandes-modification",
      icone: FileEdit,
      texte: pluriel(compteurs.demandes, "demande de modification en attente", "demandes de modification en attente")
    });
  if (nombreEchouees > 0 && estAgent)
    notifications.push({
      cle: "synchro",
      vers: "/agent/synchronisation",
      icone: RefreshCw,
      texte: pluriel(nombreEchouees, "synchronisation en échec", "synchronisations en échec")
    });

  return (
    <div className="eva-app">
      <a href="#contenu" className="eva-lien-evitement">
        Aller au contenu
      </a>
      <header className="eva-entete">
        <div className="eva-entete__gauche">
          <button
            ref={refBoutonMenu}
            type="button"
            className="eva-bouton-hamburger"
            onClick={() => setBarreOuverte((v) => !v)}
            aria-label={barreOuverte ? "Fermer le menu" : "Ouvrir le menu"}
            aria-expanded={barreOuverte}
            aria-controls="navigation-principale"
          >
            {barreOuverte ? <X size={22} aria-hidden="true" /> : <Menu size={22} aria-hidden="true" />}
          </button>
          <Link to="/" className="eva-entete__logo" aria-label="E-Vital, accueil">
            <Logo variante="horizontal-inverse" hauteur={26} alt="" />
          </Link>
        </div>
        <div className="eva-entete__droite">
          {estAgent ? (
            <Link to="/agent/synchronisation" className={classesSynchro} role="status" title="Voir la synchronisation">
              {indicateurSynchro}
            </Link>
          ) : (
            <span className={classesSynchro} role="status">
              {indicateurSynchro}
            </span>
          )}

          <div className="eva-menu-utilisateur">
            <MenuDeroulant
              ariaLabel={totalNotifications > 0 ? `Notifications, ${totalNotifications} à traiter` : "Notifications"}
              classeDeclencheur="eva-menu-utilisateur__declencheur eva-menu-utilisateur__declencheur--icone"
              classePanneau="eva-menu-deroulant--notifications"
              declencheur={
                <>
                  <Bell size={18} aria-hidden="true" />
                  {totalNotifications > 0 && (
                    <span className="eva-menu-utilisateur__pastille" aria-hidden="true">
                      {totalNotifications > 99 ? "99+" : totalNotifications}
                    </span>
                  )}
                </>
              }
            >
              <EnteteMenu>
                <strong>Notifications</strong>
                <span>{totalNotifications > 0 ? `${pluriel(totalNotifications, "élément demande", "éléments demandent")} votre attention` : "Tout est à jour"}</span>
              </EnteteMenu>
              {notifications.length === 0 && (
                <div className="eva-menu-deroulant__vide" role="presentation">
                  <CheckCircle2 size={24} aria-hidden="true" />
                  Rien à signaler.
                </div>
              )}
              {notifications.map((notification) => (
                <ItemMenu key={notification.cle} vers={notification.vers} icone={notification.icone}>
                  {notification.texte}
                </ItemMenu>
              ))}
            </MenuDeroulant>
          </div>

          <div className="eva-menu-utilisateur">
            <MenuDeroulant
              ariaLabel="Menu utilisateur"
              classeDeclencheur="eva-menu-utilisateur__declencheur"
              declencheur={
                <>
                  {utilisateur && <Avatar nom={utilisateur.nom} prenoms={utilisateur.prenoms} />}
                  <span className="eva-menu-utilisateur__nom">{utilisateur?.prenoms}</span>
                  <ChevronDown size={15} aria-hidden="true" />
                </>
              }
            >
              <EnteteMenu>
                <strong>
                  {utilisateur?.prenoms} {utilisateur?.nom}
                </strong>
                <span className="texte-mono">{utilisateur?.email}</span>
                {utilisateur && <span>{LIBELLES_ROLE[utilisateur.role]}</span>}
              </EnteteMenu>
              <ItemMenu vers={CHEMIN_COMPTE} icone={UserCircle2}>
                Mon compte
              </ItemMenu>
              <SeparateurMenu />
              <ItemMenu icone={LogOut} danger onClick={seDeconnecter}>
                Déconnexion
              </ItemMenu>
            </MenuDeroulant>
          </div>
        </div>
      </header>

      <div className="eva-corps">
        {barreOuverte && <div className="eva-fond-superposition-mobile" onClick={() => setBarreOuverte(false)} aria-hidden="true" />}
        <nav
          ref={refNavigation}
          id="navigation-principale"
          aria-label="Navigation principale"
          className={`eva-barre-laterale${barreOuverte ? " eva-barre-laterale--ouverte" : ""}`}
        >
          <div className="eva-barre-laterale__defilement">
            {liens.map((lien) => {
              const Icone = lien.icone;
              const compteur = lien.cleCompteur ? compteurParCle[lien.cleCompteur] : 0;

              if (!lien.sousLiens) {
                const actif = location.pathname === lien.chemin;
                return (
                  <Link
                    key={lien.chemin}
                    to={lien.chemin}
                    className={`eva-lien-nav${actif ? " eva-lien-nav--actif" : ""}`}
                    aria-current={actif ? "page" : undefined}
                  >
                    <Icone size={18} aria-hidden="true" />
                    <span className="eva-lien-nav__texte">{lien.libelle}</span>
                    {compteur > 0 && <span className="eva-puce eva-lien-nav__puce">{compteur}</span>}
                  </Link>
                );
              }

              const actifSection = location.pathname === lien.chemin;
              const ouvert = !!groupesOuverts[lien.chemin];
              const sousActif = lien.sousLiens.some((sl) => `${location.pathname}${location.search}` === sl.chemin);
              const idSousMenu = `sous-menu-${lien.chemin.replace(/[^a-z0-9]+/gi, "-")}`;
              return (
                <div key={lien.chemin} className="eva-groupe-nav">
                  <button
                    type="button"
                    className={`eva-lien-nav eva-lien-nav--groupe${actifSection && !sousActif ? " eva-lien-nav--actif" : ""}${sousActif ? " eva-lien-nav--parent" : ""}`}
                    onClick={() => basculerGroupe(lien.chemin)}
                    aria-expanded={ouvert}
                    aria-controls={idSousMenu}
                  >
                    <Icone size={18} aria-hidden="true" />
                    <span className="eva-lien-nav__texte">{lien.libelle}</span>
                    {compteur > 0 && <span className="eva-puce">{compteur}</span>}
                    <ChevronDown size={15} className="eva-lien-nav__chevron" aria-hidden="true" />
                  </button>
                  <div id={idSousMenu} className={`eva-sous-menu-enveloppe${ouvert ? " eva-sous-menu-enveloppe--ouvert" : ""}`}>
                    <div className="eva-sous-menu">
                      {lien.sousLiens.map((sousLien) => {
                        const sousActifLien = `${location.pathname}${location.search}` === sousLien.chemin;
                        const sousCompteur = sousLien.cleCompteur ? compteurParCle[sousLien.cleCompteur] : 0;
                        return (
                          <Link
                            key={sousLien.chemin}
                            to={sousLien.chemin}
                            className={`eva-lien-nav eva-sous-lien-nav${sousActifLien ? " eva-lien-nav--actif" : ""}`}
                            aria-current={sousActifLien ? "page" : undefined}
                          >
                            <span className="eva-lien-nav__texte">{sousLien.libelle}</span>
                            {sousCompteur > 0 && <span className="eva-puce eva-lien-nav__puce">{sousCompteur}</span>}
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="eva-barre-laterale__pied">
            <div className="eva-barre-laterale__etat">
              <span className={`eva-point-statut ${enLigne ? "eva-point-statut--ok" : "eva-point-statut--attente"}`} aria-hidden="true" />
              {libelleConnexion}
            </div>
            {!enLigne && <p>Vos saisies restent sur cet appareil et seront envoyées dès le retour de la connexion.</p>}
            {nombreEnAttente > 0 &&
              (estAgent ? (
                <p>
                  <Link to="/agent/synchronisation">{pluriel(nombreEnAttente, "action en attente", "actions en attente")}</Link> de synchronisation.
                </p>
              ) : (
                <p>{pluriel(nombreEnAttente, "action en attente", "actions en attente")} de synchronisation.</p>
              ))}
          </div>
        </nav>
        <main className="eva-principal" id="contenu" tabIndex={-1} ref={refPrincipal}>
          {children}
        </main>
      </div>
    </div>
  );
}
