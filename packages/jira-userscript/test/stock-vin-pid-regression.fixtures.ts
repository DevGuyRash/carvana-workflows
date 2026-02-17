export type ExtractionFixture = {
  name: string;
  text: string;
  direct?: {
    stock?: string;
    vin?: string;
    pid?: string;
  };
  expected: {
    stock: string;
    vin: string;
    pid: string;
    stockInvoice: string;
  };
};

export type InvoiceNumberFixture = {
  name: string;
  invoiceId: string;
  relatedLineCount: number;
  usableStock: string;
  invoiceDateText: string;
  priorDateModeCount: number;
  expectedInvoiceNumber: string;
};

export type ProjectNumberStockFixture = {
  name: string;
  description: string;
  expectedProjectNumberStock: string;
};

export type Attribute6PidFixture = {
  name: string;
  description: string;
  expectedPid: string;
};

export const extractionFixtures: ExtractionFixture[] = [
  {
    name: 'descriptor: prefix + stock + vin + status suffix',
    text: 'H&D-2123456789-1HGCM82633A004352-CORRECTED-TITLE',
    expected: {
      stock: 'H&D-2123456789',
      vin: '1HGCM82633A004352',
      pid: '',
      stockInvoice: '2123456789'
    }
  },
  {
    name: 'descriptor: stock + modifier + vin + pid + suffix',
    text: 'R1-2345678901-ADJ-5YJ3E1EA7KF317000-98765-DUPLICATE-TITLE',
    expected: {
      stock: 'R1-2345678901-ADJ',
      vin: '5YJ3E1EA7KF317000',
      pid: '98765',
      stockInvoice: '2345678901-ADJ'
    }
  },
  {
    name: 'descriptor: no prefix + vin + pid',
    text: '2345678901-2HGFC2F69MH512345-54321',
    expected: {
      stock: '2345678901',
      vin: '2HGFC2F69MH512345',
      pid: '54321',
      stockInvoice: '2345678901'
    }
  },
  {
    name: 'label path: same-line values',
    text: 'Stock Number: ABC-3456789012\nVIN: 1N4AL3AP8JC123456\nPID: 445566',
    expected: {
      stock: 'ABC-3456789012',
      vin: '1N4AL3AP8JC123456',
      pid: '445566',
      stockInvoice: '3456789012'
    }
  },
  {
    name: 'label path: next-line values',
    text: 'Stock Number:\n QW-4567890123\nVIN Number\n WAUZZZ8V3JA000001\nPID:\n 777888',
    expected: {
      stock: 'QW-4567890123',
      vin: 'WAUZZZ8V3JA000001',
      pid: '777888',
      stockInvoice: '4567890123'
    }
  },
  {
    name: 'vin-like stock rejected',
    text: 'Stock Number: 1HGCM82633A004352',
    expected: {
      stock: '',
      vin: '',
      pid: '',
      stockInvoice: ''
    }
  },
  {
    name: 'direct fields win over free text',
    text: 'Stock Number: ZZ-9999999999\nVIN: 9BWZZZ377VT004251\nPID: 10001',
    direct: {
      stock: 'AA-1111111111',
      vin: 'JH4DA9350LS000321',
      pid: '32100'
    },
    expected: {
      stock: 'AA-1111111111',
      vin: 'JH4DA9350LS000321',
      pid: '32100',
      stockInvoice: '1111111111'
    }
  }
];

export const projectNumberStockFixtures: ProjectNumberStockFixture[] = [
  {
    name: 'extracts numeric project stock from descriptor with prefix and suffix',
    description: 'H&D-2123456789-1HGCM82633A004352-CORRECTED-TITLE',
    expectedProjectNumberStock: '2123456789'
  },
  {
    name: 'extracts numeric project stock from stock label',
    description: 'Stock Number: ABC-3456789012',
    expectedProjectNumberStock: '3456789012'
  },
  {
    name: 'returns empty for vin-like stock',
    description: 'Stock Number: 1HGCM82633A004352',
    expectedProjectNumberStock: ''
  }
];

export const attribute6PidFixtures: Attribute6PidFixture[] = [
  {
    name: 'extracts pid from explicit label',
    description: 'PID Number: 445566',
    expectedPid: '445566'
  },
  {
    name: 'extracts pid from descriptor with suffix',
    description: 'R1-2345678901-ADJ-5YJ3E1EA7KF317000-98765-DUPLICATE-TITLE',
    expectedPid: '98765'
  },
  {
    name: 'returns empty when descriptor has no pid',
    description: 'H&D-2123456789-1HGCM82633A004352-CORRECTED-TITLE',
    expectedPid: ''
  }
];

export const invoiceNumberFixtures: InvoiceNumberFixture[] = [
  {
    name: 'stock mode when one related line and stock exists',
    invoiceId: 'INV-1',
    relatedLineCount: 1,
    usableStock: '2123456789',
    invoiceDateText: '02172026',
    priorDateModeCount: 0,
    expectedInvoiceNumber: '2123456789-TR'
  },
  {
    name: 'date mode when stock missing',
    invoiceId: 'INV-2',
    relatedLineCount: 1,
    usableStock: '',
    invoiceDateText: '02172026',
    priorDateModeCount: 0,
    expectedInvoiceNumber: '02172026-TR'
  },
  {
    name: 'date mode precedence when multiple related lines',
    invoiceId: 'INV-3',
    relatedLineCount: 3,
    usableStock: '2123456789',
    invoiceDateText: '02172026',
    priorDateModeCount: 0,
    expectedInvoiceNumber: '02172026-TR'
  },
  {
    name: 'date mode increments after prior entries',
    invoiceId: 'INV-4',
    relatedLineCount: 2,
    usableStock: '',
    invoiceDateText: '02172026',
    priorDateModeCount: 2,
    expectedInvoiceNumber: '02172026-2-TR'
  },
  {
    name: 'empty invoice id returns empty output',
    invoiceId: '',
    relatedLineCount: 1,
    usableStock: '2123456789',
    invoiceDateText: '02172026',
    priorDateModeCount: 0,
    expectedInvoiceNumber: ''
  }
];
