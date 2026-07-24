// Camada mínima de planilhas sobre ExcelJS. Mantém a API usada pelo legado
// enquanto remove a dependência SheetJS/xlsx (com vulnerabilidades conhecidas).
import ExcelJS from "exceljs";

const columnName = index => {
  let name = "";
  for (let n = index + 1; n; n = Math.floor((n - 1) / 26))
    name = String.fromCharCode(65 + ((n - 1) % 26)) + name;
  return name;
};

const encodeCell = ({r, c}) => `${columnName(c)}${r + 1}`;

const sheetFromRows = rows => {
  const sheet = {__rows: rows.map(row => Array.isArray(row) ? [...row] : [])};
  sheet.__rows.forEach((row, r) => row.forEach((value, c) => {
    sheet[encodeCell({r, c})] = {v: value};
  }));
  return sheet;
};

const cellValue = cell => {
  const value = cell?.value;
  if (value == null) return "";
  if (value instanceof Date) return value;
  if (typeof value === "object") {
    if ("result" in value) return value.result ?? "";
    if ("text" in value) return value.text ?? "";
    if (Array.isArray(value.richText)) return value.richText.map(x => x.text || "").join("");
  }
  return value;
};

const rowsFromWorksheet = worksheet => {
  const rows = [];
  for (let r = 1; r <= worksheet.rowCount; r++) {
    const row = [];
    const excelRow = worksheet.getRow(r);
    for (let c = 1; c <= worksheet.columnCount; c++) row.push(cellValue(excelRow.getCell(c)));
    while (row.length && row[row.length - 1] === "") row.pop();
    rows.push(row);
  }
  return rows;
};

const read = async buffer => {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const result = {SheetNames: [], Sheets: {}};
  workbook.eachSheet(worksheet => {
    result.SheetNames.push(worksheet.name);
    result.Sheets[worksheet.name] = sheetFromRows(rowsFromWorksheet(worksheet));
  });
  return result;
};

const bookNew = () => ({SheetNames: [], Sheets: {}});
const appendSheet = (book, sheet, requestedName) => {
  let name = String(requestedName || "Planilha").slice(0, 31) || "Planilha";
  let suffix = 2;
  while (book.Sheets[name]) name = `${String(requestedName).slice(0, 27)} (${suffix++})`;
  book.SheetNames.push(name);
  book.Sheets[name] = sheet;
};

const writeFile = async (book, fileName) => {
  const workbook = new ExcelJS.Workbook();
  for (const name of book.SheetNames) {
    const source = book.Sheets[name];
    const worksheet = workbook.addWorksheet(name);
    (source.__rows || []).forEach(row => worksheet.addRow(row));
    (source["!cols"] || []).forEach((column, index) => {
      worksheet.getColumn(index + 1).width = Number(column?.wch || 10);
    });
    if (source["!autofilter"]?.ref) worksheet.autoFilter = source["!autofilter"].ref;
  }
  const bytes = await workbook.xlsx.writeBuffer();
  const url = URL.createObjectURL(new Blob([bytes], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

const jsonToSheet = records => {
  const headers = [...new Set((records || []).flatMap(item => Object.keys(item || {})))];
  return sheetFromRows([headers, ...(records || []).map(item => headers.map(key => item?.[key] ?? ""))]);
};

const sheetToJson = (sheet, options = {}) => {
  const defval = options.defval ?? "";
  const rows = (sheet?.__rows || []).map(row => row.map(value => value ?? defval));
  if (options.header === 1) {
    if (options.raw === false) return rows.map(row => row.map(value => value instanceof Date ? value.toLocaleDateString("pt-BR") : String(value ?? defval)));
    return rows;
  }
  const [headers = [], ...body] = rows;
  return body.map(row => Object.fromEntries(headers.map((header, index) => [header, row[index] ?? defval])));
};

export const utils = {
  aoa_to_sheet: sheetFromRows,
  json_to_sheet: jsonToSheet,
  sheet_to_json: sheetToJson,
  book_new: bookNew,
  book_append_sheet: appendSheet,
  encode_cell: encodeCell,
};

export {read, writeFile};
