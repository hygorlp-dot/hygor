import "../styles/portal.css";

const date = value => {
  if (!value) return "";
  const parsed=new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : new Intl.DateTimeFormat("pt-BR",{dateStyle:"medium"}).format(parsed);
};

export function ClientDocumentsPage({ data = {} }) {
  const documents=data.publishedDocuments || data.documents || [];
  return <div className="arcd-client-page">
    <header className="arcd-client-page__header">
      <p>Arquivos compartilhados</p>
      <h2>Documentos da obra</h2>
      <span>Somente documentos liberados individualmente pela equipe aparecem aqui.</span>
    </header>
    <section className="arcd-client-section">
      {documents.length ? <div className="arcd-client-stack">{documents.map(document=><article className="arcd-client-record" key={document.id}>
        <div className="arcd-client-record__heading">
          <div><p className="arcd-client-record__eyebrow">{document.category || "Documento"}</p><h3>{document.title || document.nome || "Documento da obra"}</h3></div>
          {document.version && <b>v{document.version}</b>}
        </div>
        {document.publishedAt && <p>Publicado em {date(document.publishedAt)}</p>}
        <a className="arcd-client-link" href={document.url} target="_blank" rel="noreferrer">Abrir documento publicado</a>
      </article>)}</div> : <p className="arcd-client-muted">Nenhum documento foi liberado para este acesso.</p>}
    </section>
  </div>;
}
