export const MODELS = [
  { id: "claude-opus-4-6",   label: "Claude Opus 4",  provider: "anthropic" },
  { id: "claude-sonnet-4-6", label: "Claude Sonnet 4", provider: "anthropic" },
  { id: "gpt-4o",            label: "GPT-4o",          provider: "openai" },
  { id: "gpt-4o-mini",       label: "GPT-4o mini",     provider: "openai" },
] as const;

export type ModelId = typeof MODELS[number]["id"];

export function getModelLabel(id: string): string {
  return MODELS.find((m) => m.id === id)?.label ?? id;
}
