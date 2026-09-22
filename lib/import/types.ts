import type {EnduranceTemplate,Exercise,PlannedLoad} from "@/lib/setra/types";

export type ImportSourceType="pasted_text"|"uploaded_image"|"uploaded_file"|"future_ios_share"|"future_android_share";
export type ImportModality="strength"|"endurance";
export type ImportConfidence="high"|"medium"|"low";
export type ImportIssueSeverity="info"|"warning"|"error";

export type ImportSessionPayload={
  sourceType:ImportSourceType;
  rawText?:string;
  file?:{name:string;mimeType:string;size:number};
  sourceApp?:string;
  createdAt:string;
};

export type ImportIssue={id:string;severity:ImportIssueSeverity;code:string;message:string;itemId?:string;field?:string};
export type ExerciseMatch={status:"matched"|"needs_review"|"unmatched";exercise?:Exercise;suggestions:Exercise[]};
export type ImportedStrengthExercise={
  id:string;
  rawName:string;
  exerciseId?:string;
  matchStatus:ExerciseMatch["status"];
  suggestions:Exercise[];
  sets?:number;
  reps:string;
  notes:string;
  plannedLoad?:PlannedLoad;
  groupKey?:string;
  groupLabel?:string;
  createCustom?:boolean;
};
export type StrengthImportDraft={kind:"strength";name:string;focus:string;exercises:ImportedStrengthExercise[];supersetNames:Record<string,string>};
export type EnduranceImportDraft={kind:"endurance";template:EnduranceTemplate};
export type ImportParseResult={payload:ImportSessionPayload;modality:ImportModality;confidence:ImportConfidence;issues:ImportIssue[];draft:StrengthImportDraft|EnduranceImportDraft};
