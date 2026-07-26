import "./styles.css";

export function FormSection({ title, description, children }) {
  return <section className="arcd-form-section">{title && <h2 className="arcd-form-section__title">{title}</h2>}{description && <p className="arcd-form-section__description">{description}</p>}{children}</section>;
}
