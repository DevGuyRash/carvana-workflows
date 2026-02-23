import {
  DESCRIPTOR_REGEX,
  PID_PATTERN,
  STOCK_NORMALIZE_REGEX,
  STOCK_PATTERN,
  VIN_ONLY_REGEX,
  VIN_PATTERN
} from './tr-upload-sheet-regex.contract';

const SID_ZERO_WIDTH_REGEX = /[\s\u200B\u200C\u200D\u2060\uFEFF]+/g;
const ATTRIBUTE6_PID_DESCRIPTOR_REGEX =
  /(?:^|[^A-Z0-9&])(?:[A-Z0-9&]{2,8}-)?\d{7,12}(?:-(?:[A-Z]{2,8}|\d{1,4}))?-[A-HJ-NPR-Z0-9]{11,17}-(\d{3,})(?:-[A-Z0-9&]{2,30})*(?:$|[^A-Z0-9&])/i;

const normalizeHyphens = (value: string): string =>
  value
    .replace(/[\u00A0\u2007\u202F]/g, ' ')
    .replace(/\s*[-\u2010\u2011\u2012\u2013\u2014\u2015\uFE58\uFE63\uFF0D]\s*/g, '-');

const sid = (value: string): string => normalizeHyphens(value).replace(SID_ZERO_WIDTH_REGEX, '').trim();

const isBlank = (value: string): boolean => {
  const v = value.trim();
  return !v || /^(n\/?a|-|—)$/i.test(v);
};

export const findValueByLabel = (text: string, label: string, pattern: string): string => {
  const source = String(text ?? '');
  const labelRegex = new RegExp(`\\b${label}(?:\\s*number(?:s)?)?\\b`, 'ig');
  let match: RegExpExecArray | null;

  while ((match = labelRegex.exec(source))) {
    const after = source.slice(match.index + match[0].length);
    const sameLine = normalizeHyphens(after.split('\n', 2)[0] ?? '');
    const sameLineMatch = new RegExp(`^\\s*(?:[#:\\(\\)\\[\\]\\-]\\s*)*${pattern}`, 'i').exec(sameLine);
    if (sameLineMatch) return sid(sameLineMatch[1] ?? '');

    const lines = after.split('\n');
    for (const rawLine of lines) {
      const line = normalizeHyphens(rawLine);
      if (!line.trim()) continue;
      if (!/[A-Za-z0-9]/.test(line)) continue;
      const lineMatch = new RegExp(`^\\s*${pattern}`, 'i').exec(line);
      if (lineMatch) return sid(lineMatch[1] ?? '');
      break;
    }
  }

  return '';
};

export const extractIdentifiers = (text: string, direct?: { stock?: string; vin?: string; pid?: string }) => {
  let stock = sid(direct?.stock ?? '');
  let vin = sid(direct?.vin ?? '');
  let pid = sid(direct?.pid ?? '');

  if (isBlank(stock)) stock = findValueByLabel(text, 'stock', STOCK_PATTERN);
  if (isBlank(vin)) vin = findValueByLabel(text, 'vin', VIN_PATTERN);
  if (isBlank(pid)) pid = findValueByLabel(text, 'pid', PID_PATTERN);

  const descriptor = DESCRIPTOR_REGEX.exec(normalizeHyphens(text).toUpperCase());
  if (descriptor) {
    if (isBlank(stock)) stock = `${descriptor[1] ?? ''}${descriptor[2] ? `-${descriptor[2]}` : ''}`;
    if (isBlank(vin)) vin = descriptor[3] ?? '';
    if (isBlank(pid)) pid = descriptor[4] ?? '';
  }

  stock = sid(stock);
  vin = sid(vin);
  pid = sid(pid);

  if (stock && VIN_ONLY_REGEX.test(stock)) stock = '';

  let stockInvoice = stock;
  const stockNormalized = STOCK_NORMALIZE_REGEX.exec(stock);
  if (stockNormalized) {
    const stockBase = sid(stockNormalized[1] ?? '').toUpperCase();
    const stockTag = sid(stockNormalized[2] ?? '').toUpperCase();
    const numericBase = stockBase.replace(/^[A-Z0-9&]{2,8}-/, '');
    stock = stockTag ? `${stockBase}-${stockTag}` : stockBase;
    stockInvoice = stockTag ? `${numericBase}-${stockTag}` : numericBase;
  }

  return { stock, vin, pid, stockInvoice };
};

export const computeProjectNumberStock = (description: string): string => {
  const extracted = extractIdentifiers(description);
  return extracted.stockInvoice;
};

export const computeAttribute6Pid = (description: string): string => {
  const canonicalText = normalizeHyphens(String(description ?? '').toUpperCase());
  const pidByLabel = findValueByLabel(canonicalText, 'pid', PID_PATTERN);
  if (pidByLabel) return pidByLabel;
  const descriptorMatch = ATTRIBUTE6_PID_DESCRIPTOR_REGEX.exec(canonicalText);
  return sid(descriptorMatch?.[1] ?? '');
};

export const computeInvoiceNumber = (args: {
  invoiceId: string;
  relatedLineCount: number;
  usableStock: string;
  invoiceDateText: string;
  priorDateModeCount: number;
}): string => {
  if (!args.invoiceId) return '';
  const dateSequence = args.priorDateModeCount + 1;
  const dateInvoiceNumber = `${args.invoiceDateText}${dateSequence === 1 ? '' : `-${dateSequence - 1}`}-TR`;
  const stockInvoiceNumber = `${args.usableStock}-TR`;
  const useDateMode = args.relatedLineCount > 1 || args.usableStock === '';
  return useDateMode ? dateInvoiceNumber : stockInvoiceNumber;
};
