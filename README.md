# E-Vital — Frontend (PWA agent CEC / admin CEC / parent)

PWA React + TypeScript + Vite. Consomme l'API REST du backend Django (`/api/v1/...`).
Tout le code applicatif est en `.tsx`/`.ts` ; aucun `.jsx`/`.js` dans `src/`.

## Demarrage

```bash
cp .env.example .env
# ajuster VITE_API_BASE_URL si le backend ne tourne pas sur localhost:8000

npm install
npm run dev
```

`npm run type-check` verifie les types sans generer de build (utile en CI).
`npm run build` fait `tsc -b` puis `vite build` : la compilation echoue si un type ne passe pas.

## Structure

- `src/types/domaine.ts` — tous les types metier, alignes sur les serializers DRF du backend (Dossier, Utilisateur, Acte, DemandeModificationActe, ConflitSync, NouvelleVersionDossier, statistiques...)
- `src/lib/apiClient.ts` — client HTTP unique, typage generique (`appelApi<T>(...)`), JWT + rafraichissement automatique, classe `ErreurApi`
- `src/lib/apiPublic.ts` — meme role pour les endpoints publics parent/declarant (`appelApiPublic<T>(...)`, aucun jeton joint)
- `src/lib/db.ts` / `src/lib/syncService.ts` — file d'actions hors-ligne (Dexie/IndexedDB, typee) et sa synchronisation vers `/sync/batch`
- `src/lib/useCompteurs.ts` — compteurs de notifications (echeances, conflits, demandes en attente) affiches en badge dans la navigation
- `src/context/AuthContext.tsx` — connexion email/mot de passe + code 2FA
- `src/components/Logo.tsx` — point d'entree unique du logo (variantes officielles uniquement, voir le cahier d'identite)
- `src/components/MiseEnPage.tsx` — ossature d'application (en-tete, barre laterale responsive, cloche de notifications, menu utilisateur)
- `src/components/ui/` — bibliotheque de composants partages (Bouton, Champ, Carte, Badge, Tableau, Modale, Toast, Confirmation, Pagination, Onglets, Frise...) ; voir `src/components/ui/index.ts` pour la liste complete
- `src/pages/auth/` — connexion, verification du code, mot de passe oublie
- `src/pages/agent/` — parcours agent CEC (tableau de bord, dossiers avec pagination/filtres, detail avec historique et traitement des nouvelles versions DHIS2, creation manuelle, emission d'acte, retrait par QR/code/telephone, conflits de synchronisation)
- `src/pages/admin_cec/` — tableau de bord avec graphiques (Recharts) et indicateurs, gestion des agents/administrateurs (edition, activation/desactivation), validation ou rejet des demandes de modification d'acte
- `src/pages/parent/` — formulaire de completion public, suivi de statut, recherche de code perdu par telephone (lien + code, sans authentification)
- `src/pages/PageMonCompte.tsx` — profil et changement de mot de passe, partage entre agent_cec et admin_cec

Voir `ROADMAP.md` pour le suivi detaille de la refonte design et des evolutions fonctionnelles.

## Identite visuelle

Tous les SVG officiels sont dans `src/assets/brand/` (copies nettoyees de leurs metadonnees). Ne jamais recreer le logo en texte ou en CSS ailleurs dans le code : passer systematiquement par `<Logo variante="..." />`.

Couleurs et typographies centralisees dans `src/styles/theme.css` (variables CSS) — ne jamais coder une couleur en dur dans un composant. Le reste du systeme de design (espacements, rayons, ombres, composants `eva-*`) est libre d'evoluer sans toucher a ces tokens de marque.

## Hors-ligne

L'agent CEC peut consulter un dossier deja charge et mettre en file ses
modifications sans connexion (Dexie/IndexedDB). Au retour du reseau
(evenement `online`), la file est automatiquement envoyee a
`POST /sync/batch`. Un conflit (dossier modifie en ligne entre-temps par un
collegue de la meme mairie) n'ecrase jamais la version en ligne : il est
journalise et visible dans `/agent/conflits`.

## Ce qui reste a completer

- Generation d'icones PNG/maskable pour le manifest PWA (le SVG suffit pour le developpement, une vraie release beneficierait d'exports raster depuis les fichiers sources de l'identite visuelle)
- Ecran de creation de demande de modification d'acte cote agent (le backend expose deja `POST /dossiers/{id}/acte/demande-modification` ; aujourd'hui seule la file de validation cote Admin CEC existe)
- Gestion hierarchique des sous-administrateurs, configuration des campagnes de relance, export de rapports, journal d'activite de zone — voir `ROADMAP.md` section "Phase 2" (necessitent des decisions/endpoints backend non encore disponibles)
- Tests automatises

