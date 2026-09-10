export default function Spinner() {
  return <span className="eva-spinner" />;
}

export function ChargementPage({ texte = "Chargement..." }: { texte?: string }) {
  return (
    <div className="eva-page-chargement">
      <Spinner />
      <span>{texte}</span>
    </div>
  );
}
