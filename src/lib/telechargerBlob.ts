/** Declenche le telechargement d'un Blob deja recupere (export xlsx/pdf...), sans naviguer hors de l'app. */
export function telechargerBlob(blob: Blob, nomFichier: string): void {
  const url = URL.createObjectURL(blob);
  const lien = document.createElement("a");
  lien.href = url;
  lien.download = nomFichier;
  document.body.appendChild(lien);
  lien.click();
  lien.remove();
  URL.revokeObjectURL(url);
}
