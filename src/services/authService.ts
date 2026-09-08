import { appelApi } from "../lib/apiClient";
import type { Utilisateur } from "../types/domaine";

export interface ModificationProfil {
  nom: string;
  prenoms: string;
}

export function obtenirMonProfil(): Promise<Utilisateur> {
  return appelApi<Utilisateur>("/utilisateurs/me/");
}

export function modifierMonProfil(donnees: ModificationProfil): Promise<Utilisateur> {
  return appelApi<Utilisateur>("/utilisateurs/me/", { methode: "PATCH", corps: donnees });
}

export function changerMotDePasse(ancienMotDePasse: string, nouveauMotDePasse: string): Promise<{ message: string }> {
  return appelApi<{ message: string }>("/auth/changer-mot-de-passe", {
    methode: "POST",
    corps: { ancien_mot_de_passe: ancienMotDePasse, nouveau_mot_de_passe: nouveauMotDePasse }
  });
}

export function demanderReinitialisationMotDePasse(email: string): Promise<{ message: string }> {
  return appelApi<{ message: string }>("/auth/mot-de-passe-oublie/demander", {
    methode: "POST",
    corps: { email }
  });
}

export function confirmerReinitialisationMotDePasse(
  uidb64: string,
  token: string,
  nouveauMotDePasse: string
): Promise<{ message: string }> {
  return appelApi<{ message: string }>("/auth/mot-de-passe-oublie/confirmer", {
    methode: "POST",
    corps: { uidb64, token, nouveau_mot_de_passe: nouveauMotDePasse }
  });
}
