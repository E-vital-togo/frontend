import { useEffect, useMemo, useState } from "react";
import { AlertOctagon, CheckCircle2, Clock, FolderOpen } from "lucide-react";
import {
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import MiseEnPage from "../../components/MiseEnPage";
import BadgeStatut from "../../components/BadgeStatut";
import { Carte, CarteStat, Champ, ChargementPage, EnteteDePage, Tableau } from "../../components/ui";
import { LienBouton } from "../../components/ui/Bouton";
import { appelApi } from "../../lib/apiClient";
import { LIENS_ADMIN_CEC } from "./navigation";
import type { Dossier, ListeOuPaginee, StatistiqueEvolutionReponse, StatistiqueRepartitionItem } from "../../types/domaine";
import { listeDepuis } from "../../types/domaine";

const COULEUR_PAR_STATUT: Record<string, string> = {
  recu: "#6B7A73",
  notifie: "#40534B",
  en_attente_complement: "#A8BB1E",
  complete: "#16B37D",
  acte_emis: "#0B7A57",
  sans_suite: "#B3261E",
  non_renseigne: "#C9D2C6"
};

const PALETTE_OUVERTE = ["#0B7A57", "#16B37D", "#A8BB1E", "#40534B", "#6B7A73", "#C8D92F", "#8AA69B", "#B3261E"];

function joursDepuisAujourdhui(dateIso: string): number {
  const debutAujourdhui = new Date();
  debutAujourdhui.setHours(0, 0, 0, 0);
  const diff = new Date(dateIso).getTime() - debutAujourdhui.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

// Memes seuils que settings.SEUILS_RELANCE_JOURS cote backend (J-10/J-3).
function couleurUrgence(jours: number): string {
  if (jours <= 3) return "var(--couleur-erreur)";
  if (jours <= 10) return "var(--couleur-citron-profond)";
  return "var(--couleur-gris-service-1)";
}

export default function TableauDeBordAdminCec() {
  const [dateDebut, setDateDebut] = useState("");
  const [dateFin, setDateFin] = useState("");
  const [repartitionStatut, setRepartitionStatut] = useState<StatistiqueRepartitionItem[] | null>(null);
  const [repartitionMairie, setRepartitionMairie] = useState<StatistiqueRepartitionItem[] | null>(null);
  const [evolution, setEvolution] = useState<StatistiqueEvolutionReponse | null>(null);
  const [echeancesProches, setEcheancesProches] = useState<Dossier[]>([]);
  const [delaiMoyenJours, setDelaiMoyenJours] = useState<number | null>(null);
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    const parametres = new URLSearchParams();
    if (dateDebut) parametres.set("date_debut", dateDebut);
    if (dateFin) parametres.set("date_fin", dateFin);
    const suffixe = parametres.toString() ? `&${parametres.toString()}` : "";

    setChargement(true);
    Promise.all([
      appelApi<StatistiqueRepartitionItem[]>(`/dossiers/statistiques/repartition/?dimension=statut${suffixe}`),
      appelApi<StatistiqueRepartitionItem[]>(`/dossiers/statistiques/repartition/?dimension=mairie${suffixe}`),
      appelApi<StatistiqueEvolutionReponse>(`/dossiers/statistiques/evolution/?intervalle=mois&serie=event_type${suffixe}`),
      appelApi<ListeOuPaginee<Dossier>>("/dossiers/?echeance_proche=true"),
      appelApi<{ delai_moyen_jours: number | null }>(`/dossiers/statistiques/delai-moyen/?${parametres.toString()}`)
    ])
      .then(([statuts, mairies, evol, echeances, delai]) => {
        setRepartitionStatut(statuts);
        setRepartitionMairie(mairies);
        setEvolution(evol);
        setEcheancesProches(listeDepuis(echeances));
        setDelaiMoyenJours(delai.delai_moyen_jours);
      })
      .finally(() => setChargement(false));
  }, [dateDebut, dateFin]);

  const total = useMemo(() => repartitionStatut?.reduce((s, r) => s + r.valeur, 0) ?? 0, [repartitionStatut]);
  const actesEmis = useMemo(() => repartitionStatut?.find((r) => r.cle === "acte_emis")?.valeur ?? 0, [repartitionStatut]);
  const sansSuite = useMemo(() => repartitionStatut?.find((r) => r.cle === "sans_suite")?.valeur ?? 0, [repartitionStatut]);
  const tauxExpiration = total > 0 ? Math.round((sansSuite / total) * 100) : 0;

  return (
    <MiseEnPage liens={LIENS_ADMIN_CEC}>
      <EnteteDePage titre="Vue d'ensemble de la zone" sousTitre="Tous les dossiers de votre perimetre territorial" />

      <div className="eva-carte" style={{ display: "flex", gap: 14, marginBottom: 20, alignItems: "flex-end", flexWrap: "wrap" }}>
        <div style={{ flex: "0 1 180px" }}>
          <Champ id="date-debut" label="Depuis le">
            <input id="date-debut" type="date" value={dateDebut} onChange={(e) => setDateDebut(e.target.value)} />
          </Champ>
        </div>
        <div style={{ flex: "0 1 180px" }}>
          <Champ id="date-fin" label="Jusqu'au">
            <input id="date-fin" type="date" value={dateFin} onChange={(e) => setDateFin(e.target.value)} />
          </Champ>
        </div>
        <p style={{ fontSize: 12.5, color: "var(--couleur-gris-service-2)", paddingBottom: 14 }}>
          Filtre sur la date de declaration. Laisser vide pour voir l'historique complet.
        </p>
      </div>

      {chargement ? (
        <ChargementPage />
      ) : (
        <>
          <div className="grille-cartes" style={{ marginBottom: 24 }}>
            <CarteStat icone={<FolderOpen size={22} />} valeur={total} libelle="Dossiers (periode)" />
            <CarteStat icone={<CheckCircle2 size={22} />} valeur={actesEmis} libelle="Actes emis" />
            <CarteStat icone={<AlertOctagon size={22} />} valeur={`${tauxExpiration}%`} libelle="Taux d'expiration" alerte={tauxExpiration > 15} />
            <CarteStat icone={<Clock size={22} />} valeur={echeancesProches.length} libelle="Echeances proches (zone)" alerte={echeancesProches.length > 0} />
            <CarteStat
              icone={<Clock size={22} />}
              valeur={delaiMoyenJours !== null ? `${delaiMoyenJours} j` : "-"}
              libelle="Delai moyen declaration -> acte"
            />
          </div>

          <div className="eva-grille-2" style={{ marginBottom: 24 }}>
            <Carte>
              <h2 style={{ fontSize: 14, marginBottom: 14 }}>Repartition par statut</h2>
              {total === 0 ? (
                <p style={{ color: "var(--couleur-gris-service-2)", fontSize: 13.5 }}>Aucun dossier sur cette periode.</p>
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie data={repartitionStatut ?? []} dataKey="valeur" nameKey="libelle" innerRadius={55} outerRadius={90} paddingAngle={2}>
                      {(repartitionStatut ?? []).map((entree) => (
                        <Cell key={entree.cle} fill={COULEUR_PAR_STATUT[entree.cle] ?? "#8AA69B"} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend verticalAlign="bottom" height={48} wrapperStyle={{ fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </Carte>

            <Carte>
              <h2 style={{ fontSize: 14, marginBottom: 14 }}>Repartition par mairie</h2>
              {!repartitionMairie || repartitionMairie.length === 0 ? (
                <p style={{ color: "var(--couleur-gris-service-2)", fontSize: 13.5 }}>Aucun dossier sur cette periode.</p>
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie data={repartitionMairie} dataKey="valeur" nameKey="libelle" outerRadius={90}>
                      {repartitionMairie.map((entree, index) => (
                        <Cell key={entree.cle} fill={PALETTE_OUVERTE[index % PALETTE_OUVERTE.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend verticalAlign="bottom" height={48} wrapperStyle={{ fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </Carte>
          </div>

          <Carte style={{ marginBottom: 24 }}>
            <h2 style={{ fontSize: 14, marginBottom: 14 }}>Evolution mensuelle</h2>
            {!evolution || evolution.donnees.length === 0 ? (
              <p style={{ color: "var(--couleur-gris-service-2)", fontSize: 13.5 }}>Pas assez de donnees pour tracer une evolution.</p>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={evolution.donnees}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--couleur-bordure)" />
                  <XAxis dataKey="periode" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  {evolution.series.map((serie, index) => (
                    <Line key={serie} type="monotone" dataKey={serie} stroke={PALETTE_OUVERTE[index % PALETTE_OUVERTE.length]} strokeWidth={2} dot={false} />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            )}
          </Carte>

          {echeancesProches.length > 0 && (
            <Carte>
              <h2 style={{ fontSize: 14, marginBottom: 10 }}>Dossiers a echeance proche dans la zone</h2>
              <Tableau>
                <thead>
                  <tr>
                    <th>Evenement</th>
                    <th>Mairie</th>
                    <th>Statut</th>
                    <th>Jours restants</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {echeancesProches
                    .slice()
                    .sort((a, b) => joursDepuisAujourdhui(a.date_limite) - joursDepuisAujourdhui(b.date_limite))
                    .map((d) => {
                      const jours = joursDepuisAujourdhui(d.date_limite);
                      return (
                        <tr key={d.id}>
                          <td>{d.event_type === "naissance" ? "Naissance" : "Deces"}</td>
                          <td>{d.mairie_nom || d.mairie}</td>
                          <td>
                            <BadgeStatut statut={d.statut} />
                          </td>
                          <td>
                            <strong style={{ color: couleurUrgence(jours) }}>
                              {jours <= 0 ? "Echue" : `${jours} jour${jours > 1 ? "s" : ""}`}
                            </strong>
                          </td>
                          <td>
                            <LienBouton to={`/admin-cec/dossiers/${d.id}`} variante="fantome" taille="petit">
                              Ouvrir
                            </LienBouton>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </Tableau>
            </Carte>
          )}
        </>
      )}
    </MiseEnPage>
  );
}
