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

- `src/types/domaine.ts` — tous les types metier, alignes sur les serializers DRF du backend (Dossier, Utilisateur, Acte, DemandeModificationActe, ConflitSync...)
- `src/lib/apiClient.ts` — client HTTP unique, typage generique (`appelApi<T>(...)`), JWT + rafraichissement automatique, classe `ErreurApi`
- `src/lib/db.ts` / `src/lib/syncService.ts` — file d'actions hors-ligne (Dexie/IndexedDB, typee) et sa synchronisation vers `/sync/batch`
- `src/context/AuthContext.tsx` — connexion email/mot de passe + code 2FA
- `src/components/Logo.tsx` — point d'entree unique du logo (variantes officielles uniquement, voir le cahier d'identite)
- `src/pages/auth/` — connexion et verification du code
- `src/pages/agent/` — parcours agent CEC (tableau de bord, dossiers, creation manuelle, emission d'acte, conflits de synchronisation)
- `src/pages/admin_cec/` — tableau de bord agrege, gestion des agents/administrateurs, demandes de modification d'acte
- `src/pages/parent/` — formulaire de completion public (lien + code, sans authentification)

## Identite visuelle

Tous les SVG officiels sont dans `src/assets/brand/` (copies nettoyees de leurs metadonnees). Ne jamais recreer le logo en texte ou en CSS ailleurs dans le code : passer systematiquement par `<Logo variante="..." />`.

Couleurs et typographies centralisees dans `src/styles/theme.css` (variables CSS) — ne jamais coder une couleur en dur dans un composant.

## Hors-ligne

L'agent CEC peut consulter un dossier deja charge et mettre en file ses
modifications sans connexion (Dexie/IndexedDB). Au retour du reseau
(evenement `online`), la file est automatiquement envoyee a
`POST /sync/batch`. Un conflit (dossier modifie en ligne entre-temps par un
collegue de la meme mairie) n'ecrase jamais la version en ligne : il est
journalise et visible dans `/agent/conflits`.

## Ce qui reste a completer

- Generation d'icones PNG/maskable pour le manifest PWA (le SVG suffit pour le developpement, une vraie release beneficierait d'exports raster depuis les fichiers sources de l'identite visuelle)
- Scan de QR code cote agent (verification de signature deja geree cote backend via `/codes-retrait/qr/verifier`, reste a brancher une lecture camera, ex. librairie `zxing` ou `html5-qrcode`)
- Ecran de creation de demande de modification d'acte (le backend expose deja `POST /dossiers/{id}/acte/demande-modification`)
- Ecran de validation (pas seulement rejet) des demandes de modification cote Admin CEC, avec saisie des nouveaux numeros
- Tests automatises

