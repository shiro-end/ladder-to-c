export type Manufacturer = "mitsubishi" | "keyence";
export type StepStatus = "pending" | "active" | "complete";

export interface Rung {
  id: string;
  number: number;
  pageNumber: number;
  inputs: string;
  output: string;
  comment: string;
  warning: string | null;
}

export interface ConversionEntry {
  id: string;
  plcDevice: string;
  cVariable: string;
  dataType: string;
  description: string;
}

export interface Session {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  activeStep: 1 | 2 | 3 | 4;
  manufacturer: Manufacturer;
  pdfName: string | null;
  pageCount: number;
  rungs: Rung[] | null;
  conversionTable: ConversionEntry[] | null;
  cCode: string | null;
  interpretationDoc: string | null;
}
