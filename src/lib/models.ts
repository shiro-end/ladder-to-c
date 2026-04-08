import { useState, useEffect, useRef } from "react";

export const MODELS = [
  { id: "gpt-4o-mini",       label: "GPT-4o mini",    provider: "openai" },
  { id: "gpt-4o",            label: "GPT-4o",          provider: "openai" },
  { id: "claude-sonnet-4-6", label: "Claude Sonnet 4", provider: "anthropic" },
  { id: "claude-opus-4-6",   label: "Claude Opus 4",   provider: "anthropic" },
] as const;

export const DEFAULT_MODEL = "gpt-4o-mini";

export type ModelId = typeof MODELS[number]["id"];

export function getModelLabel(id: string): string {
  return MODELS.find((m) => m.id === id)?.label ?? id;
}

/** トリプルクリックでロック解除できるhook。localStorageで状態を永続化 */
export function useModelUnlock() {
  const [unlocked, setUnlocked] = useState(false);
  const clickCount = useRef(0);
  const clickTimer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    setUnlocked(localStorage.getItem("modelUnlocked") === "true");
  }, []);

  function handleTripleClick() {
    clickCount.current += 1;
    clearTimeout(clickTimer.current);
    if (clickCount.current >= 3) {
      clickCount.current = 0;
      setUnlocked((prev) => {
        const next = !prev;
        localStorage.setItem("modelUnlocked", next ? "true" : "false");
        return next;
      });
    } else {
      clickTimer.current = setTimeout(() => {
        clickCount.current = 0;
      }, 600);
    }
  }

  return { unlocked, handleTripleClick };
}
