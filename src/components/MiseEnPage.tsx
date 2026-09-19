import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Bell, ChevronDown, ChevronUp, LogOut, Menu, UserCircle2, X } from "lucide-react";
import Logo from "./Logo";
import { useAuth } from "../context/AuthContext";
import { dossiersAvecActionsEnAttente, listerActionsEnAttente, purgerCacheExpire } from "../lib/db";
import { precacherFormulaires } from "../lib/formulairesHorsLigne";
import { synchroniser, surRetourConnexion } from "../lib/syncService";
import { useCompteurs } from "../lib/useCompteurs";
import { estEnLigne, useConnectivite } from "../lib/connectivite";
import type { LienNavigation } from "../types/domaine";

interface ProprietesMiseEnPage {
  liens: LienNavigation[];
  children: ReactNode;
}

const CHEMIN_COMPTE = "/mon-compte";

function initiales(nom: string, prenoms: string): string {
  return `${prenoms.charAt(0)}${nom.charAt(0)}`.toUpperCase();
}

export default function MiseEnPage({ liens, children }: ProprietesMiseEnPage) {
  const { utilisateur, deconnecter } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const compteurs = useCompteurs();

  const [nombreEnAttente, setNombreEnAttente] = useState(0);
  const enLigne = useConnectivite();
  const [barreOuverte, setBarreOuverte] = useState(false);
  const [menuUtilisateurOuvert, setMenuUtilisateurOuvert] = useState(false);
  const [notificationsOuvertes, setNotificationsOuvertes] = useState(false);
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
  const refMenuUtilisateur = useRef<HTMLDivElement>(null);
  const refNotifications = useRef<HTMLDivElement>(null);

  async function rafraichirCompteurSync() {
    const actions = await listerActionsEnAttente();
    setNombreEnAttente(actions.length);
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

  useEffect(() => {
    function surClicExterieur(evenement: MouseEvent) {
      if (refMenuUtilisateur.current && !refMenuUtilisateur.current.contains(evenement.target as Node)) {
        setMenuUtilisateurOuvert(false);
      }
      if (refNotifications.current && !refNotifications.current.contains(evenement.target as Node)) {
        setNotificationsOuvertes(false);
      }
    }
    document.addEventListener("mousedown", surClicExterieur);
    return () => document.removeEventListener("mousedown", surClicExterieur);
  }, []);

  function seDeconnecter() {
    deconnecter();
    navigate("/connexion");
  }

  function basculerGroupe(chemin: string) {
    setGroupesOuverts((precedent) => ({ ...precedent, [chemin]: !precedent[chemin] }));
  }

  const totalNotifications = compteurs.echeances + compteurs.conflits + compteurs.demandes + compteurs.notificationsEchouees;

  const compteurParCle: Record<string, number> = {
    echeances: compteurs.echeances,
    echeancesNaissance: compteurs.echeancesNaissance,
    echeancesDeces: compteurs.echeancesDeces,
    conflits: compteurs.conflits,
    demandes: compteurs.demandes,
    notificationsEchouees: compteurs.notificationsEchouees
  };

  return (
    <div className="eva-app">
      <header className="eva-entete">
        <div className="eva-entete__gauche">
          <button className="eva-bouton-hamburger" onClick={() => setBarreOuverte((v) => !v)} aria-label="Ouvrir le menu">
            {barreOuverte ? <X size={22} /> : <Menu size={22} />}
          </button>
          <Logo variante="horizontal-inverse" hauteur={24} />
        </div>
        <div className="eva-entete__droite">
          <span
            className={`eva-statut-connexion${enLigne ? "" : " eva-statut-connexion--hors-ligne"}`}
            title={enLigne ? "Connecte" : "Hors-ligne"}
          >
            <span className="eva-statut-connexion__point" />
            {enLigne ? "En ligne" : "Hors-ligne"}
            {nombreEnAttente > 0 && ` · ${nombreEnAttente} en attente`}
          </span>

          <div className="eva-menu-utilisateur" ref={refNotifications}>
            <button
              className="eva-menu-utilisateur__declencheur"
              onClick={() => setNotificationsOuvertes((v) => !v)}
              aria-label="Notifications"
            >
              <Bell size={17} />
              {totalNotifications > 0 && <span className="eva-puce eva-puce--alerte">{totalNotifications}</span>}
            </button>
            {notificationsOuvertes && (
              <div className="eva-menu-deroulant" style={{ minWidth: 260 }}>
                <div className="eva-menu-deroulant__entete" style={{ fontSize: 13, fontWeight: 600 }}>
                  Notifications
                </div>
                {totalNotifications === 0 && (
                  <div style={{ padding: "10px 10px", fontSize: 13, color: "var(--couleur-gris-service-2)" }}>
                    Rien a signaler.
                  </div>
                )}
                {compteurs.echeances > 0 && (
                  <Link to="/agent/dossiers?echeance=1" className="eva-menu-deroulant__item">
                    {compteurs.echeances} dossier(s) proche(s) de l'echeance
                  </Link>
                )}
                {compteurs.conflits > 0 && (
                  <Link
                    to={utilisateur?.role === "admin_cec" ? "/admin-cec/conflits" : "/agent/conflits"}
                    className="eva-menu-deroulant__item"
                  >
                    {compteurs.conflits} conflit(s) de synchronisation
                  </Link>
                )}
                {compteurs.notificationsEchouees > 0 && (
                  <Link to="/admin-cec/notifications-echouees" className="eva-menu-deroulant__item">
                    {compteurs.notificationsEchouees} notification(s) en echec
                  </Link>
                )}
                {compteurs.demandes > 0 && (
                  <Link to="/admin-cec/demandes-modification" className="eva-menu-deroulant__item">
                    {compteurs.demandes} demande(s) de modification en attente
                  </Link>
                )}
              </div>
            )}
          </div>

          <div className="eva-menu-utilisateur" ref={refMenuUtilisateur}>
            <button className="eva-menu-utilisateur__declencheur" onClick={() => setMenuUtilisateurOuvert((v) => !v)}>
              <span className="eva-avatar">{utilisateur ? initiales(utilisateur.nom, utilisateur.prenoms) : ""}</span>
              <span>{utilisateur?.prenoms}</span>
            </button>
            {menuUtilisateurOuvert && (
              <div className="eva-menu-deroulant">
                <div className="eva-menu-deroulant__entete">
                  <div style={{ fontWeight: 600, fontSize: 13.5 }}>
                    {utilisateur?.prenoms} {utilisateur?.nom}
                  </div>
                  <div className="texte-mono" style={{ fontSize: 11.5, color: "var(--couleur-gris-service-2)" }}>
                    {utilisateur?.email}
                  </div>
                </div>
                <Link to={CHEMIN_COMPTE} className="eva-menu-deroulant__item" onClick={() => setMenuUtilisateurOuvert(false)}>
                  <UserCircle2 size={16} /> Mon compte
                </Link>
                <button className="eva-menu-deroulant__item eva-menu-deroulant__item--danger" onClick={seDeconnecter}>
                  <LogOut size={16} /> Deconnexion
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="eva-corps">
        {barreOuverte && <div className="eva-fond-superposition-mobile" onClick={() => setBarreOuverte(false)} />}
        <nav className={`eva-barre-laterale${barreOuverte ? " eva-barre-laterale--ouverte" : ""}`}>
          {liens.map((lien) => {
            const Icone = lien.icone;
            const compteur = lien.cleCompteur ? compteurParCle[lien.cleCompteur] : 0;

            if (!lien.sousLiens) {
              const actif = location.pathname === lien.chemin;
              return (
                <Link key={lien.chemin} to={lien.chemin} className={`eva-lien-nav${actif ? " eva-lien-nav--actif" : ""}`}>
                  <Icone size={17} />
                  {lien.libelle}
                  {compteur > 0 && <span className="eva-puce eva-lien-nav__puce">{compteur}</span>}
                </Link>
              );
            }

            const actifSection = location.pathname === lien.chemin;
            const ouvert = !!groupesOuverts[lien.chemin];
            return (
              <div key={lien.chemin} className="eva-groupe-nav">
                <button
                  type="button"
                  className={`eva-lien-nav--g${actifSection ? " eva-lien-nav--actif" : ""}`}
                  onClick={() => basculerGroupe(lien.chemin)}
                  aria-expanded={ouvert}
                >
                  <Icone size={17} />
                  {lien.libelle}
                  {compteur > 0 && <span className="eva-puce eva-lien-nav__puce">{compteur}</span>}
                  {ouvert ? <ChevronUp size={15} className="eva-lien-nav__chevron" /> : <ChevronDown size={15} className="eva-lien-nav__chevron" />}
                </button>
                {ouvert && (
                  <div className="eva-sous-menu">
                    {lien.sousLiens.map((sousLien) => {
                      const sousActif = `${location.pathname}${location.search}` === sousLien.chemin;
                      const sousCompteur = sousLien.cleCompteur ? compteurParCle[sousLien.cleCompteur] : 0;
                      return (
                        <Link
                          key={sousLien.chemin}
                          to={sousLien.chemin}
                          className={`eva-lien-nav eva-sous-lien-nav${sousActif ? " eva-lien-nav--actif" : ""}`}
                        >
                          {sousLien.libelle}
                          {sousCompteur > 0 && <span className="eva-puce eva-lien-nav__puce">{sousCompteur}</span>}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
        <main className="eva-principal">{children}</main>
      </div>
    </div>
  );
}
