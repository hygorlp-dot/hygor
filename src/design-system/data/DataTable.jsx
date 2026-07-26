import { useEffect, useMemo, useState } from "react";
import { DataTableColumnMenu } from "./DataTableColumnMenu.jsx";
import { DataTablePagination } from "./DataTablePagination.jsx";
import { DataTableToolbar } from "./DataTableToolbar.jsx";
import { MobileRecordList } from "./MobileRecordList.jsx";
import "./styles.css";

function useMobileTable() {
  const query = "(max-width: 767px)";
  const [mobile, setMobile] = useState(() => typeof window !== "undefined" && window.matchMedia?.(query).matches);
  useEffect(() => {
    const media = window.matchMedia?.(query);
    if (!media) return undefined;
    const update = event => setMobile(event.matches);
    media.addEventListener?.("change", update);
    return () => media.removeEventListener?.("change", update);
  }, []);
  return mobile;
}

function displayValue(row, column) { return column.sortValue ? column.sortValue(row) : row[column.key]; }

export function DataTable({ data = [], columns = [], rowKey = "id", search, pagination = { pageSize: 20 }, onRowClick, loading = false, emptyMessage = "Nenhum registro encontrado.", mobile, mobileConfig }) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState(null);
  const [page, setPage] = useState(0);
  const [visible, setVisible] = useState(() => columns.map(column => column.key));
  const detectedMobile = useMobileTable();
  const useCards = mobile ?? detectedMobile;
  const visibleColumns = columns.filter(column => visible.includes(column.key));
  const filtered = useMemo(() => {
    const term = query.trim().toLocaleLowerCase("pt-BR");
    const fields = search?.fields || [];
    if (!term || !fields.length) return data;
    return data.filter(row => fields.some(field => String(typeof field === "function" ? field(row) : row[field] ?? "").toLocaleLowerCase("pt-BR").includes(term)));
  }, [data, query, search]);
  const sorted = useMemo(() => {
    if (!sort) return filtered;
    const column = columns.find(item => item.key === sort.key);
    return [...filtered].sort((left, right) => String(displayValue(left, column) ?? "").localeCompare(String(displayValue(right, column) ?? ""), "pt-BR", { numeric: true }) * sort.direction);
  }, [columns, filtered, sort]);
  const pageSize = pagination?.pageSize || 20;
  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize));
  const currentPage = Math.min(page, pageCount - 1);
  const rows = sorted.slice(currentPage * pageSize, (currentPage + 1) * pageSize);
  const toggleColumn = key => setVisible(items => items.includes(key) ? items.filter(item => item !== key) : [...items, key]);
  const changeSearch = value => { setQuery(value); setPage(0); };
  const changeSort = key => setSort(current => current?.key === key ? { key, direction: current.direction * -1 } : { key, direction: 1 });
  return <section className="arcd-data-table" aria-busy={loading || undefined}>
    <DataTableToolbar search={search} value={query} onChange={changeSearch}>{columns.some(column => column.hideable !== false) && <DataTableColumnMenu columns={columns} visible={visible} onChange={toggleColumn} />}</DataTableToolbar>
    {loading ? <div className="arcd-data-table__empty" role="status">Carregando registros…</div> : rows.length === 0 ? <div className="arcd-data-table__empty">{emptyMessage}</div> : useCards ? <MobileRecordList rows={rows} rowKey={rowKey} columns={visibleColumns} config={mobileConfig} onRowClick={onRowClick} /> : <table className="arcd-data-table__table"><thead><tr>{visibleColumns.map(column => <th key={column.key} scope="col">{column.sortable === false ? column.header : <button className="arcd-data-table__sort" onClick={() => changeSort(column.key)}>{column.header}{sort?.key === column.key ? (sort.direction > 0 ? " ↑" : " ↓") : ""}</button>}</th>)}</tr></thead><tbody>{rows.map(row => <tr key={row[rowKey]} className={onRowClick ? "arcd-data-table__row--clickable" : undefined} tabIndex={onRowClick ? 0 : undefined} onClick={() => onRowClick?.(row)} onKeyDown={event => { if (onRowClick && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); onRowClick(row); } }}>{visibleColumns.map(column => <td key={column.key}>{column.render ? column.render(row) : String(row[column.key] ?? "—")}</td>)}</tr>)}</tbody></table>}
    <DataTablePagination page={currentPage} pageCount={pageCount} onPageChange={setPage} />
  </section>;
}
