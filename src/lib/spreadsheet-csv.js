// O parser usa setImmediate para ceder a execução entre lotes. Antes este
// polyfill vinha por efeito colateral do JSZip; agora pertence ao consumidor.
import 'setimmediate';
import {CsvFormatterStream} from '@fast-csv/format/build/src/CsvFormatterStream.js';
import {FormatterOptions} from '@fast-csv/format/build/src/FormatterOptions.js';
import {CsvParserStream} from '@fast-csv/parse/build/src/CsvParserStream.js';
import {ParserOptions} from '@fast-csv/parse/build/src/ParserOptions.js';

// Mesmas fábricas do fast-csv. O ExcelJS só utiliza parse/format, não as
// funções de arquivos Node que importam fs e util.promisify no barrel.
export const format=options=>new CsvFormatterStream(new FormatterOptions(options));
export const parse=options=>new CsvParserStream(new ParserOptions(options));
