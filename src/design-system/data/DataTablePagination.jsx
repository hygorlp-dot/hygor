import { Button } from "../primitives/Button.jsx";
import "./styles.css";

export function DataTablePagination({ page, pageCount, onPageChange }) {
  if (pageCount <= 1) return null;
  return <nav className="arcd-data-table__pagination" aria-label="Paginação"><Button variant="ghost" size="sm" disabled={page === 0} onClick={() => onPageChange(page - 1)}>Anterior</Button><span className="arcd-data-table__page">Página {page + 1} de {pageCount}</span><Button variant="ghost" size="sm" disabled={page >= pageCount - 1} onClick={() => onPageChange(page + 1)}>Próxima</Button></nav>;
}
