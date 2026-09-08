interface ProprietesSquelette {
  lignes?: number;
}

/** Remplace les <p>Chargement...</p> disperses dans chaque page. */
export default function Squelette({ lignes = 4 }: ProprietesSquelette) {
  return (
    <div role="status" aria-label="Chargement en cours">
      {Array.from({ length: lignes }).map((_, i) => (
        <div
          key={i}
          className="squelette squelette-ligne"
          style={{ width: i === lignes - 1 ? "60%" : "100%" }}
        />
      ))}
    </div>
  );
}
