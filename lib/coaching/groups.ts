import type {CoachGroup} from "./types.ts";

export const coachGroupRecipientIds=(group:CoachGroup)=>group.members.map(member=>member.relationshipId);

export const coachGroupCanAssign=(group:CoachGroup)=>
  !group.archivedAt&&group.members.length>0&&group.members.every(member=>member.assignTraining);
