# Feuille de route frontend — E-Vital

Suivi de la refonte design et des évolutions fonctionnelles du frontend PWA (agent_cec / admin_cec / parent).
Contexte complet : `docs/cahier-des-charges-processus.md` et `docs/cahier-des-charges-technique.md`.

Règle de design : couleurs et logo strictement conformes à `docs/E-Vital Identite-1-8.pdf` (déjà repris dans
`src/styles/theme.css` et `src/assets/brand/`). Le reste (mise en page, composants, densité, ergonomie) est
librement modernisé — sobre, pas de fantaisie.

Légende : `[ ]` à faire · `[~]` en cours · `[x]` fait

---

## 0. Refonte design (base commune, faite en premier)

- [x] Lecture du cahier d'identité (couleurs, typographies, logo) — déjà intégré dans `theme.css`/`assets/brand`.
- [x] Extension des tokens (`theme.css`) : espacements, rayons, ombres, breakpoints, états focus/hover/disabled.
- [x] Bibliothèque de composants `src/components/ui/` : Bouton, Champ (texte/select/textarea), Carte, Badge,
      Tableau (responsive), Vide (EmptyState), CarteStat, Modale/Confirmation, Toast, Entete de page, Spinner,
      Pagination, Onglets.
- [x] Nouvelle ossature d'application (`MiseEnPage`) : en-tête + barre latérale responsive (repli mobile),
      liens avec icônes (lucide-react), badges de compteurs, menu utilisateur.
- [x] Remplacement de tous les `window.prompt`/`window.confirm`/styles inline ad hoc par les composants ci-dessus,
      page par page.
- [x] Ajout de `recharts` (graphiques), `lucide-react` (icônes), `html5-qrcode` (scan QR retrait).

## 1. Phase 1 — Combler les trous critiques du parcours existant

### Agent CEC
- [x] Historique du dossier (`GET /historique`) sous forme de frise chronologique, en onglet dans le détail dossier.
- [x] Bandeau + écran "nouvelle version DHIS2" (accepter/refuser) sur le dossier concerné.
- [x] Écran de retrait (`/agent/retrait`) : scan QR webcam, saisie de code, recherche par téléphone.
- [x] Pagination réelle de la liste des dossiers + filtres (statut, type d'événement, échéance proche, recherche).
      Un filtre "mairie" n'a pas de sens ici : un agent_cec est déjà scopé à sa seule mairie côté backend. Un
      filtre "période" a été laissé de côté : `/dossiers/` ne l'accepte pas côté backend (seuls les endpoints
      `/statistiques/*`, utilisés par le tableau de bord admin_cec, le permettent).
- [x] Option "jugement" dans la création manuelle de dossier.
- [x] Page "Mon compte" (profil + changement de mot de passe).

### Admin CEC
- [x] Vrai tableau de bord : répartition par statut et par mairie (camemberts), évolution mensuelle (courbes),
      échéances proches de la zone, taux d'expiration, filtrable par période — basé sur
      `/dossiers/statistiques/repartition` et `/evolution` (voir notes ci-dessous pour le choix des indicateurs).
- [x] Gestion complète des agents : éditer, activer/désactiver (réinitialisation mot de passe hors scope backend
      actuel — pas d'endpoint dédié, signalé dans le code).
- [x] Écran de validation des demandes de modification (pas seulement rejet) : diff avant/après, ressaisie des
      numéros d'acte, commentaire.

### Parent / déclarant
- [x] Écran "j'ai perdu mon code" par téléphone.
- [x] Suivi de statut reformulé en étapes visuelles (timeline).

## 2. Phase 2 — Ce que le cahier des charges prévoit et qui manque encore

- [x] Gestion hiérarchique des sous-administrateurs (arbre territorial, création au niveau inférieur).
- [x] Configuration des campagnes de relance (contenu SMS, échéances), par territoire.
- [x] Journal simplifié des actions de la zone pour l'admin_cec.
- [x] Export de rapports (Excel/PDF) depuis la liste de dossiers filtrée.
- [x] Personnalisation (nom affiché, logo de la mairie sur les PDF).

## 3. Phase 3 — Confort et robustesse transverses

- [x] Design cohérent + responsive (fait dans la refonte de base, section 0).
- [x] Centre de notifications simple (échéances proches, conflits, nouvelles versions) avec badge sur la nav.
- [x] Confirmations et toasts homogènes (remplace `window.prompt`/`alert`).
- [x] Scan QR par webcam pour le retrait (fait dans l'écran de retrait, section 1).

---

## Notes d'implémentation

- Les endpoints Phase 1 (`/historique`, `/nouvelle-version/*`, `/statistiques/*`, `/utilisateurs/me/`) existent
  déjà côté backend (voir cahier des charges technique §5). Aucune modification backend n'a été nécessaire pour
  la Phase 1.
- Pas d'endpoint de réinitialisation de mot de passe par un tiers (admin_cec pour un agent) côté backend
  actuel — seul `POST /auth/mot-de-passe-oublie/demander` (self-service) existe. La gestion des agents côté
  Admin CEC couvre donc édition + activation/désactivation, pas de reset forcé.
- Tableau de bord Admin CEC : le backend ne conserve aucune date de transition d'état (seulement `created_at`
  sur `Dossier`), donc un vrai "délai moyen de traitement" n'est pas calculable sans évolution du modèle de
  données. Le KPI retenu à la place est honnête et déjà disponible : "Échéances proches (zone)"
  (`/dossiers/?echeance_proche=true`, scope automatiquement élargi à toute la zone pour un admin_cec) et un
  "Taux d'expiration" calculé depuis `/dossiers/statistiques/repartition/?dimension=statut`.
- Correctif de config découvert en cours de route : `tsconfig.node.json` déclarait `noEmit: true` sans
  `composite: true`, ce qui rendait `npm run type-check` (`tsc -b --noEmit`) et même `tsc -b` seul invalides
  (erreurs TS6306/TS6310). Corrigé (`composite: true`, `noEmit` retiré) ; `npm run build` et `npm run
  type-check` passent maintenant proprement.
- `PageRetrait` (scan QR, html5-qrcode) et `TableauDeBordAdminCec` (graphiques Recharts) sont chargés en lazy
  (`React.lazy`) : ce sont les deux plus grosses dépendances du bundle, inutiles au parcours agent CEC de
  base — les séparer garde la PWA légère sur une connexion terrain faible (bundle principal ~350 Ko contre
  ~1,1 Mo si tout est chargé d'un bloc).
- Les items Phase 2 marqués "nécessite un endpoint backend" ne sont pas démarrés côté frontend tant que le
  contrat d'API n'est pas défini, pour éviter de construire sur une API imaginée.

## Phase 2 — détail de ce qui a été ajouté (backend + frontend)

Contrairement à la Phase 1, ces cinq points nécessitaient du **nouveau code backend** (aucun endpoint n'existait) :
modèles, migrations, serializers, vues, et dans deux cas des gabarits/tâches Celery modifiés. Résumé par point :

- **Hiérarchie des sous-administrateurs** — le backend le permettait déjà (`peut_creer_admin_cec`, voir
  `apps/utilisateurs/services.py`) ; seul le frontend manquait. `UtilisateursAdminCec`
  détecte maintenant le type de territoire de l'admin connecté (`GET /territoires/{id}/`) pour proposer soit la
  création d'un agent (scope préfecture/commune), soit celle d'un administrateur CEC du niveau immédiatement
  inférieur (scope pays/région/préfecture), soit les deux (cas préfecture) — reproduit fidèlement
  `NIVEAU_ENFANT` côté backend plutôt que de deviner une règle.
- **Campagnes de relance** — nouveau modèle `CampagneRelance` (`apps/notifications/models.py`), résolu "au plus
  spécifique" en remontant l'arbre des territoires (`resoudre_campagne_relance`), branché dans
  `apps/dossiers/tasks.verifier_echeances_et_expirations` (seuils) et `apps/notifications/tasks.envoyer_relance`
  (message). Sans campagne configurée, le comportement par défaut national (J-10/J-3, message générique)
  s'applique sans changement. Endpoint `/campagnes-relance/` (CRUD, scope territorial vérifié serveur). Le
  frontend propose deux granularités pratiques : toute la zone de l'admin, ou une commune précise — pas un
  sélecteur d'arbre générique, pour rester simple d'usage.
- **Journal de zone** — nouvel endpoint `GET /journal-zone/` (`apps/core/api_views.py`), premier point d'entrée
  REST d'`apps.core` (jusqu'ici seulement des vues Django Template pour l'Admin Général). Filtre les logs Mongo
  existants (`JournalisationMongoMiddleware`) aux seuls auteurs du périmètre de l'appelant, et traduit les
  chemins d'API les plus courants en libellés français (ex. "a validé un dossier") via une table de motifs —
  tout chemin non reconnu s'affiche tel quel plutôt que de planter.
- **Export de rapports** — nouvelle action `GET /dossiers/export/?format=xlsx|pdf`, qui rejoue exactement les
  mêmes filtres que l'écran de liste (`self.filter_queryset(self.get_queryset())`, jamais dupliqués). Plafonné à
  5000 lignes (`MAX_LIGNES_EXPORT`) pour rester un outil de lecture humaine, pas une extraction de masse. Ajouté
  à la liste de dossiers de l'agent existante *et* à une nouvelle page "Dossiers de la zone" côté Admin CEC (qui
  n'avait jusqu'ici qu'un tableau de bord agrégé, jamais de liste individuelle filtrable).
- **Personnalisation** — `Mairie.logo` (nouveau champ `ImageField`) ; `Mairie.nom` existait déjà et servait déjà
  d'affichage (le nom "officiel" séparé n'existe pas dans ce modèle). Action dédiée
  `PATCH /mairies/{id}/personnalisation/`, volontairement plus restreinte que le CRUD complet
  (réservé à l'Admin Général) : un Admin CEC ne peut toucher que `nom`/`logo` de sa propre mairie. Le logo est
  intégré aux PDF d'actes en base64 (`_logo_en_data_uri`), jamais par URL, pour que le PDF reste généré-able hors
  contexte HTTP (worker Celery) ; son nom de fichier est inclus dans le hash de cache du PDF pour invalider
  correctement un ancien acte mis en cache après un changement de logo.

Migrations générées (`territoires/migrations/0003_mairie_logo.py`,
`notifications/migrations/0002_campagnerelance_and_more.py`) mais **non appliquées** dans cet environnement
(pas de PostgreSQL accessible ici) — `python manage.py migrate` reste à lancer avant déploiement/tests avec une
vraie base.
