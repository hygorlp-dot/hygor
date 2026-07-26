import { DataTable } from "./DataTable.jsx";

export function ResponsiveDataTable({ mobile, ...props }) {
  return <DataTable {...props} mobileConfig={mobile} />;
}
