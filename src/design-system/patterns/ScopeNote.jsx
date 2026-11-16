import './scope-note.css';

/** Explain a view's actual scope without changing the shared work selector. */
export function ScopeNote({title,children}){
 return <p className="mrc-scope-note" role="note"><strong>{title}: </strong>{children}</p>;
}
