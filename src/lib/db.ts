"use client";

import { getSupabaseClient } from "./supabase";
import type { Session, Project, Manufacturer, Rung, ClarificationQuestion, ConversionEntry } from "@/types/session";

/* ── Projects ── */

export async function getProjects(): Promise<Project[]> {
  const { data } = await getSupabaseClient()
    .from("projects")
    .select("*")
    .order("created_at", { ascending: false });
  return (data ?? []).map((r) => ({
    id: r.id as string,
    name: r.name as string,
    createdAt: r.created_at as string,
  }));
}

export async function createProject(name: string): Promise<Project> {
  const { data, error } = await getSupabaseClient()
    .from("projects")
    .insert({ name })
    .select()
    .single();
  if (error) throw error;
  return { id: data.id, name: data.name, createdAt: data.created_at };
}

export async function deleteProject(id: string): Promise<void> {
  await getSupabaseClient().from("projects").delete().eq("id", id);
}

/* ── Sessions ── */

export async function getSessions(): Promise<Session[]> {
  const { data } = await getSupabaseClient()
    .from("sessions")
    .select("*")
    .order("updated_at", { ascending: false });
  return (data ?? []).map(rowToSession);
}

export async function getSession(id: string): Promise<Session | null> {
  const { data } = await getSupabaseClient()
    .from("sessions")
    .select("*")
    .eq("id", id)
    .single();
  return data ? rowToSession(data) : null;
}

export async function saveSession(session: Session): Promise<void> {
  await getSupabaseClient().from("sessions").upsert({
    id: session.id,
    name: session.name,
    project_id: session.projectId,
    manufacturer: session.manufacturer,
    pdf_name: session.pdfName,
    page_count: session.pageCount,
    active_step: session.activeStep,
    rungs: session.rungs,
    clarifications: session.clarifications,
    conversion_table: session.conversionTable,
    c_code: session.cCode,
    interpretation_doc: session.interpretationDoc,
    pdf_page_urls: session.pdfPageUrls,
    updated_at: new Date().toISOString(),
  });
}

export async function createSession(
  id: string,
  manufacturer: Manufacturer,
  pdfName: string,
  projectId: string | null = null
): Promise<Session> {
  const name = `${pdfName} — ${new Date().toLocaleDateString("ja-JP")}`;
  const { data, error } = await getSupabaseClient()
    .from("sessions")
    .insert({ id, name, manufacturer, pdf_name: pdfName, project_id: projectId })
    .select()
    .single();
  if (error) throw error;
  return rowToSession(data);
}

export async function deleteSession(id: string): Promise<void> {
  await getSupabaseClient().from("sessions").delete().eq("id", id);
}

export async function updateSessionName(id: string, name: string): Promise<void> {
  await getSupabaseClient()
    .from("sessions")
    .update({ name, updated_at: new Date().toISOString() })
    .eq("id", id);
}

/* ── Helpers ── */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToSession(r: any): Session {
  return {
    id: r.id,
    name: r.name,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    projectId: r.project_id ?? null,
    activeStep: r.active_step as 1 | 2 | 3 | 4,
    manufacturer: r.manufacturer as Manufacturer,
    pdfName: r.pdf_name ?? null,
    pageCount: r.page_count ?? 0,
    rungs: (r.rungs as Rung[]) ?? null,
    clarifications: (r.clarifications as ClarificationQuestion[]) ?? null,
    conversionTable: (r.conversion_table as ConversionEntry[]) ?? null,
    cCode: r.c_code ?? null,
    interpretationDoc: r.interpretation_doc ?? null,
    pdfPageUrls: (r.pdf_page_urls as string[]) ?? null,
  };
}
