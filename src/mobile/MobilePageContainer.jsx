import "./styles.css";
export function MobilePageContainer({ children, className = "" }) { return <main className={`arcd-mobile-page ${className}`.trim()}>{children}</main>; }
