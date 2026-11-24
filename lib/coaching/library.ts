import type { CoachProgram } from "./types.ts";
import type { EnduranceTemplate, Template } from "../setra/types.ts";

export type CoachLibraryType = "strength" | "endurance" | "program";

export const duplicateStrengthTemplate = (
  template: Template,
  id: string,
): Template => ({
  ...structuredClone(template),
  id,
  name: `${template.name} Copy`,
  updatedAt: undefined,
  archivedAt: undefined,
  coachAssignmentId: undefined,
  assignedByCoach: undefined,
  coachInstruction: undefined,
  coachDayPosition: undefined,
  coachFeedback: undefined,
  coachProgramName: undefined,
  coachProgramWeek: undefined,
  coachProgramDurationWeeks: undefined,
});

export const duplicateEnduranceTemplate = (
  template: EnduranceTemplate,
  id: string,
): EnduranceTemplate => ({
  ...structuredClone(template),
  id,
  title: `${template.title} Copy`,
  updatedAt: undefined,
  archivedAt: undefined,
});

export const duplicateCoachProgram = (
  program: CoachProgram,
  idFactory: () => string,
): CoachProgram => ({
  ...structuredClone(program),
  id: "",
  name: `${program.name} Copy`,
  createdAt: "",
  updatedAt: "",
  archivedAt: undefined,
  sessions: program.sessions.map((session) => ({
    ...structuredClone(session),
    id: idFactory(),
  })),
});

export const libraryMatches = (
  name: string,
  query: string,
  archivedAt: string | undefined,
  showArchived: boolean,
) => {
  if (Boolean(archivedAt) !== showArchived) return false;
  return name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase());
};
