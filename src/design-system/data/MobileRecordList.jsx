import { MobileRecordCard } from "./MobileRecordCard.jsx";
import { ResponsiveRecordCard } from "./ResponsiveRecordCard.jsx";
import "./styles.css";

export function MobileRecordList({ rows = [], columns = [], config, rowKey = "id", onRowClick }) {
  return <div className="arcd-record-cards">{rows.map(row => config ? <MobileRecordCard key={row[rowKey]} row={row} columns={columns} config={config} onClick={onRowClick} /> : <ResponsiveRecordCard key={row[rowKey]} row={row} columns={columns} onClick={onRowClick} />)}</div>;
}
