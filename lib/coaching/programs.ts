import { addCalendarDays } from "../setra/week.ts";
import type { CoachProgramSession } from "./types.ts";

export const programSessionDate = (
  startDate: string,
  weekNumber: number,
  dayOffset: number,
) => addCalendarDays(startDate, (weekNumber - 1) * 7 + dayOffset);

export const duplicateProgramWeek = (
  sessions: CoachProgramSession[],
  sourceWeek: number,
  targetWeek: number,
  createId: () => string,
) => [
  ...sessions,
  ...sessions
    .filter((session) => session.weekNumber === sourceWeek)
    .map((session) => ({
      ...session,
      id: createId(),
      weekNumber: targetWeek,
    })),
];

export const programWeekForDate = (startDate: string, date: string) => {
  const start = Date.parse(`${startDate}T12:00:00Z`);
  const target = Date.parse(`${date}T12:00:00Z`);
  return Math.floor((target - start) / 86_400_000 / 7) + 1;
};
