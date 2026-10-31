import "./styles.css";

export function PageHeader({ title, description, breadcrumb = [], primaryAction, secondaryActions, children, className = "", headingLevel = 1 }) {
  const Heading = headingLevel === 2 ? "h2" : "h1";
  return <header className={`arcd-page-header ${className}`.trim()}>
    <div>
      {breadcrumb.length > 0 && <nav aria-label="Navegação estrutural" className="arcd-page-header__breadcrumbs">{breadcrumb.map((item, index) => <span key={`${item}-${index}`}>{index > 0 ? " / " : ""}{item}</span>)}</nav>}
      <Heading className="arcd-page-header__title">{title}</Heading>
      {description && <p className="arcd-page-header__description">{description}</p>}
      {children}
    </div>
    {(primaryAction || secondaryActions) && <div className="arcd-page-header__actions">{secondaryActions}{primaryAction}</div>}
  </header>;
}
