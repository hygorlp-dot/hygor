import './styles.css';

export function IdentityPreview({src,name,onLoad,onError}) {
  return <figure className="arcd-identity-preview" aria-label="Prévia da logomarca">
    <img src={src} alt={`Logomarca ${name}`} onLoad={onLoad} onError={onError}/>
    <figcaption>{name} · cabeçalho e marca-d’água do relatório</figcaption>
  </figure>;
}
