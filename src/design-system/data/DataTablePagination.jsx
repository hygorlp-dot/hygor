import { Button } from "../primitives/Button.jsx";
import {UI_TEXT} from '../copy.js';
import "./styles.css";

export function DataTablePagination({ page, pageCount, onPageChange }) {
  if (pageCount <= 1) return null;
  return <nav className="arcd-data-table__pagination" aria-label={UI_TEXT.pagination.label}><Button variant="ghost" size="sm" disabled={page === 0} onClick={() => onPageChange(page - 1)}>{UI_TEXT.actions.previous}</Button><span className="arcd-data-table__page">{UI_TEXT.pagination.page(page + 1,pageCount)}</span><Button variant="ghost" size="sm" disabled={page >= pageCount - 1} onClick={() => onPageChange(page + 1)}>{UI_TEXT.actions.next}</Button></nav>;
}
