export type Manufacturer = "mitsubishi" | "keyence";
export type StepStatus = "pending" | "active" | "complete";

export interface Project {
  id: string;
  name: string;
  createdAt: string;
}

export interface Rung {
  id: string;
  number: number;
  pageNumber: number;
  inputs: string;
  output: string;
  comment: string;
  warning: string | null;
}

export interface ClarificationQuestion {
  id: string;
  question: string;
  context: string;
  answer: string;
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
  projectId: string | null;
  activeStep: 1 | 2 | 3 | 4;
  manufacturer: Manufacturer;
  model?: string;
  pdfName: string | null;
  pageCount: number;
  rungs: Rung[] | null;
  clarifications: ClarificationQuestion[] | null;
  conversionTable: ConversionEntry[] | null;
  cCode: string | null;
  interpretationDoc: string | null;
  pdfPageUrls: string[] | null;
}
