import JSZip from "jszip";

const decodeXml = value => String(value ?? "")
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&quot;/g, "\"")
  .replace(/&apos;/g, "'")
  .replace(/&lt;/g, "<")
  .replace(/&gt;/g, ">")
  .replace(/&amp;/g, "&");

const attribute = (source, name) => {
  const match = String(source || "").match(new RegExp(`(?:^|\\s)${name}=(?:"([^"]*)"|'([^']*)')`, "i"));
  return decodeXml(match?.[1] ?? match?.[2] ?? "");
};

const textNodes = source => {
  const values = [];
  const regex = /<t\b[^>]*>([\s\S]*?)<\/t>/gi;
  let match;
  while ((match = regex.exec(source))) values.push(decodeXml(match[1]));
  return values.join("");
};

const columnIndex = reference => {
  const letters = String(reference || "").match(/^[A-Z]+/i)?.[0]?.toUpperCase() || "";
  let result = 0;
  for (const letter of letters) result = result * 26 + letter.charCodeAt(0) - 64;
  return Math.max(0, result - 1);
};

const normalizeSheetName = value => String(value || "")
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .replace(/\s+/g, "")
  .toUpperCase();

const resolveWorksheetPath = target => {
  const clean = String(target || "").replace(/\\/g, "/").replace(/^\/+/, "");
  if (clean.startsWith("xl/")) return clean;
  return `xl/${clean.replace(/^(\.\.\/)+/, "")}`;
};

const yieldToWorker = () => new Promise(resolve => setTimeout(resolve, 0));

const unzipText = (entry, message, onProgress) => {
  let lastPercent = -1;
  return entry.async("string", metadata => {
    const percent = Math.max(0, Math.min(100, Math.round(metadata.percent || 0)));
    if (percent === lastPercent || (percent < 100 && percent % 5 !== 0)) return;
    lastPercent = percent;
    onProgress?.({
      stage:"unzip",
      percent,
      message:`${message} · ${percent}%`,
    });
  });
};

const readSharedStrings = async (zip, onProgress) => {
  const entry = zip.file("xl/sharedStrings.xml");
  if (!entry) return [];
  onProgress?.({ stage:"sharedStrings", message:"Preparando textos compartilhados do XLSX..." });
  const xml = await unzipText(entry, "Preparando textos do XLSX", onProgress);
  const strings = [];
  const regex = /<si\b[^>]*>([\s\S]*?)<\/si>/gi;
  let match;
  while ((match = regex.exec(xml))) {
    strings.push(textNodes(match[1]));
    if (strings.length % 20000 === 0) {
      onProgress?.({
        stage:"sharedStrings",
        message:`Preparando textos do XLSX · ${strings.length.toLocaleString("pt-BR")} registros...`,
      });
      await yieldToWorker();
    }
  }
  return strings;
};

const cellValue = (attributes, contents, sharedStrings) => {
  const type = attribute(attributes, "t").toLowerCase();
  const formulaMatch = contents.match(/<f\b[^>]*>([\s\S]*?)<\/f>/i);
  const valueMatch = contents.match(/<v\b[^>]*>([\s\S]*?)<\/v>/i);
  const raw = decodeXml(valueMatch?.[1] ?? "");
  let value;
  if (type === "s") value = sharedStrings[Number(raw)] ?? "";
  else if (type === "inlinestr") value = textNodes(contents);
  else if (type === "str" || type === "e") value = raw;
  else if (type === "b") value = raw === "1";
  else if (raw === "") value = "";
  else {
    const numeric = Number(raw);
    value = Number.isFinite(numeric) ? numeric : raw;
  }
  return formulaMatch
    ? { v:value, f:decodeXml(formulaMatch[1]) }
    : { v:value };
};

const readWorksheet = async (xml, sharedStrings, sheetName, onProgress) => {
  const rows = [];
  const cellsByReference = {};
  const rowRegex = /<row\b[^>]*>([\s\S]*?)<\/row>/gi;
  let rowMatch;
  let count = 0;
  let lastPercent = -1;

  while ((rowMatch = rowRegex.exec(xml))) {
    const row = [];
    const cellRegex = /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/gi;
    let cellMatch;
    let fallbackColumn = 0;
    while ((cellMatch = cellRegex.exec(rowMatch[1]))) {
      const attributes = cellMatch[1] || "";
      const reference = attribute(attributes, "r");
      const column = reference ? columnIndex(reference) : fallbackColumn;
      const cell = cellValue(attributes, cellMatch[2] || "", sharedStrings);
      row[column] = cell.v;
      if (reference && cell.f) cellsByReference[reference.toUpperCase()] = cell;
      fallbackColumn = column + 1;
    }
    rows.push(row);
    count += 1;

    if (count % 1500 === 0) {
      const percent = Math.min(99, Math.max(1, Math.round((rowRegex.lastIndex / xml.length) * 100)));
      if (percent !== lastPercent) {
        lastPercent = percent;
        onProgress?.({
          stage:"worksheet",
          sheetName,
          rows:count,
          percent,
          message:`Lendo aba ${sheetName} · ${percent}% · ${count.toLocaleString("pt-BR")} linhas...`,
        });
      }
      await yieldToWorker();
    }
  }
  onProgress?.({
    stage:"worksheet",
    sheetName,
    rows:count,
    percent:100,
    message:`Aba ${sheetName} lida · ${count.toLocaleString("pt-BR")} linhas.`,
  });
  return { __rows:rows, ...cellsByReference };
};

export const readSelectedXlsxSheets = async (bytes, {
  sheets = [],
  onProgress = () => {},
} = {}) => {
  onProgress({ stage:"zip", message:"Abrindo a estrutura compactada do XLSX..." });
  const zip = await JSZip.loadAsync(bytes);
  const workbookEntry = zip.file("xl/workbook.xml");
  const relationsEntry = zip.file("xl/_rels/workbook.xml.rels");
  if (!workbookEntry || !relationsEntry) throw new Error("O arquivo não possui uma estrutura XLSX válida.");

  const [workbookXml, relationsXml, sharedStrings] = await Promise.all([
    workbookEntry.async("string"),
    relationsEntry.async("string"),
    readSharedStrings(zip, onProgress),
  ]);

  const relationships = new Map();
  const relationshipRegex = /<Relationship\b([^>]*?)(?:\/>|><\/Relationship>)/gi;
  let relationshipMatch;
  while ((relationshipMatch = relationshipRegex.exec(relationsXml))) {
    const id = attribute(relationshipMatch[1], "Id");
    const target = attribute(relationshipMatch[1], "Target");
    if (id && target) relationships.set(id, resolveWorksheetPath(target));
  }

  const requested = sheets.map(normalizeSheetName);
  const selectedSheets = [];
  const sheetRegex = /<sheet\b([^>]*?)(?:\/>|><\/sheet>)/gi;
  let sheetMatch;
  while ((sheetMatch = sheetRegex.exec(workbookXml))) {
    const name = attribute(sheetMatch[1], "name");
    const id = attribute(sheetMatch[1], "r:id");
    const normalized = normalizeSheetName(name);
    const selected = requested.some(target => normalized === target || (target === "ANALIT" && normalized.includes("ANALIT")));
    if (selected && relationships.has(id)) selectedSheets.push({ name, path:relationships.get(id) });
  }
  if (!selectedSheets.length) throw new Error("As abas oficiais CSD, CCD, ISD, ICD ou Analítico não foram encontradas.");

  const workbook = { SheetNames:[], Sheets:{} };
  for (let sheetIndex = 0; sheetIndex < selectedSheets.length; sheetIndex += 1) {
    const selected = selectedSheets[sheetIndex];
    const entry = zip.file(selected.path);
    if (!entry) continue;
    const reportSheetProgress = event => onProgress({
      ...event,
      sheetName:selected.name,
      sheetIndex,
      totalSheets:selectedSheets.length,
      overallPercent:Math.min(100, Math.round(((sheetIndex + ((event.percent || 0) / 100)) / selectedSheets.length) * 100)),
    });
    reportSheetProgress({ stage:"worksheet", percent:0, message:`Descompactando aba ${selected.name}...` });
    const xml = await unzipText(entry, `Descompactando aba ${selected.name}`, reportSheetProgress);
    workbook.SheetNames.push(selected.name);
    workbook.Sheets[selected.name] = await readWorksheet(xml, sharedStrings, selected.name, reportSheetProgress);
    await yieldToWorker();
  }
  return workbook;
};
