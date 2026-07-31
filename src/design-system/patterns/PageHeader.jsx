import "./styles.css";

export function PageHeader({ title, description, breadcrumb = [], primaryAction, secondaryActions, children }) {
  return <header className="arcd-page-header">
    <div>
      {breadcrumb.length > 0 && <nav aria-label="Navegação estrutural" className="arcd-page-header__breadcrumbs">{breadcrumb.map((item, index) => <span key={`${item}-${index}`}>{index > 0 ? " / " : ""}{item}</span>)}</nav>}
      <h1 className="arcd-page-header__title">{title}</h1>
      {description && <p className="arcd-page-header__description">{description}</p>}
      {children}
    </div>
    {(primaryAction || secondaryActions) && <div className="arcd-page-header__actions">{secondaryActions}{primaryAction}</div>}
  </header>;
}
