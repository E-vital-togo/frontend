import { useEffect, useState, type FormEvent } from "react";
import { Image as ImageIcon, Save } from "lucide-react";
import MiseEnPage from "../../components/MiseEnPage";
import { Bouton, Carte, Champ, ChargementPage, EnteteDePage } from "../../components/ui";
import { useToast } from "../../components/ui/ToastProvider";
import { appelApi, ErreurApi } from "../../lib/apiClient";
import { LIENS_ADMIN_CEC } from "./navigation";
import { listeDepuis, type ListeOuPaginee, type Mairie } from "../../types/domaine";

export default function PersonnalisationMairie() {
  const toast = useToast();
  const [mairies, setMairies] = useState<Mairie[]>([]);
  const [mairieId, setMairieId] = useState("");
  const [nom, setNom] = useState("");
  const [fichierLogo, setFichierLogo] = useState<File | null>(null);
  const [chargement, setChargement] = useState(true);
  const [enregistrement, setEnregistrement] = useState(false);

  useEffect(() => {
    appelApi<ListeOuPaginee<Mairie>>("/mairies/")
      .then((donnees) => {
        const liste = listeDepuis(donnees);
        setMairies(liste);
        if (liste.length > 0) {
          setMairieId(liste[0].id);
          setNom(liste[0].nom);
        }
      })
      .finally(() => setChargement(false));
  }, []);

  function changerMairie(id: string) {
    setMairieId(id);
    setNom(mairies.find((m) => m.id === id)?.nom || "");
    setFichierLogo(null);
  }

  const mairieActive = mairies.find((m) => m.id === mairieId);

  async function enregistrer(evenement: FormEvent<HTMLFormElement>) {
    evenement.preventDefault();
    if (!mairieId) return;
    setEnregistrement(true);
    try {
      const donnees = new FormData();
      donnees.set("nom", nom);
      if (fichierLogo) donnees.set("logo", fichierLogo);

      const misAJour = await appelApi<Mairie>(`/mairies/${mairieId}/personnalisation/`, {
        methode: "PATCH",
        corps: donnees,
        estFormData: true
      });
      setMairies((precedent) => precedent.map((m) => (m.id === mairieId ? misAJour : m)));
      setFichierLogo(null);
      toast.succes("Mairie personnalisee. Les prochains actes generes utiliseront ce logo.");
    } catch (e) {
      toast.erreur(e instanceof ErreurApi ? e.message : "Erreur inattendue.");
    } finally {
      setEnregistrement(false);
    }
  }

  if (chargement) {
    return (
      <MiseEnPage liens={LIENS_ADMIN_CEC}>
        <ChargementPage />
      </MiseEnPage>
    );
  }

  return (
    <MiseEnPage liens={LIENS_ADMIN_CEC}>
      <EnteteDePage titre="Personnalisation" sousTitre="Nom affiche et logo utilises sur les actes PDF generes pour une mairie de votre perimetre." />

      <Carte style={{ maxWidth: 480 }}>
        <form onSubmit={enregistrer}>
          <Champ id="mairie-select" label="Mairie" requis>
            <select id="mairie-select" value={mairieId} onChange={(e) => changerMairie(e.target.value)}>
              {mairies.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nom}
                </option>
              ))}
            </select>
          </Champ>

          {mairieActive?.logo && (
            <div style={{ marginBottom: 14, display: "flex", alignItems: "center", gap: 10 }}>
              <img src={mairieActive.logo} alt="Logo actuel" style={{ height: 40, borderRadius: 6, border: "1px solid var(--couleur-bordure)" }} />
              <span style={{ fontSize: 12.5, color: "var(--couleur-gris-service-2)" }}>Logo actuel</span>
            </div>
          )}

          <Champ id="nom-mairie" label="Nom affiche" requis aide="Apparait sur les actes PDF, les SMS et le formulaire de completion en ligne.">
            <input id="nom-mairie" required value={nom} onChange={(e) => setNom(e.target.value)} />
          </Champ>

          <Champ id="logo-mairie" label="Logo" aide="Image PNG ou JPEG, affichee en en-tete des actes generes pour cette mairie.">
            <input
              id="logo-mairie"
              type="file"
              accept="image/png,image/jpeg"
              onChange={(e) => setFichierLogo(e.target.files?.[0] || null)}
            />
          </Champ>

          <Bouton type="submit" chargement={enregistrement} iconeGauche={<Save size={16} />}>
            Enregistrer
          </Bouton>
        </form>
      </Carte>

      {mairies.length === 0 && (
        <p style={{ marginTop: 16, fontSize: 13.5, color: "var(--couleur-gris-service-2)", display: "flex", alignItems: "center", gap: 6 }}>
          <ImageIcon size={15} /> Aucune mairie dans votre perimetre.
        </p>
      )}
    </MiseEnPage>
  );
}
