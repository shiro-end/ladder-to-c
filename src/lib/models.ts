export const MODELS = [
  { id: "gpt-4o-mini", label: "GPT-4o mini", provider: "openai" },
] as const;

export const DEFAULT_MODEL = "gpt-4o-mini";

export type ModelId = typeof MODELS[number]["id"];

export function getModelLabel(id: string): string {
  return MODELS.find((m) => m.id === id)?.label ?? id;
}
