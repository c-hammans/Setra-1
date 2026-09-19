import type {EnduranceTemplate,Exercise,TrainingActivityType,TrainingBlockType,TrainingCompletionType,TrainingSessionBlock} from "@/lib/setra/types";
import {matchExercise} from "./exercise-matcher.ts";
import type {EnduranceImportDraft,ImportIssue,ImportModality,ImportParseResult,ImportSessionPayload,ImportedStrengthExercise,StrengthImportDraft} from "./types";

const id=(prefix:string,index:number)=>`${prefix}-${Date.now()}-${index}`;
const cleanLine=(line:string)=>line.replace(/^\s*[-•*]\s*/,"").trim();
const enduranceSignals=/\b(run|running|ride|cycling|bike|swim|rowing|row|walk|hike|warm[ -]?up|cool[ -]?down|interval|recovery|pace|watts?|power zone|heart.?rate|hr zone|cadence)\b|\/\s*(?:km|500\s*m|100\s*m)|\b\d+(?:\.\d+)?\s*(?:km|metres?|meters?)\b/i;
const strengthSignals=/\b(sets?|reps?|rpe|rir|superset|circuit|squat|press|deadlift|curl|row|pulldown|pull.?up|lunge|raise|fly|extension)\b/i;

export function detectModality(text:string,hint?:ImportModality):{modality:ImportModality;confidence:"high"|"medium"|"low"}{
  if(hint)return {modality:hint,confidence:"high"};
  const endurance=(text.match(new RegExp(enduranceSignals.source,"gi"))||[]).length;
  const strength=(text.match(new RegExp(strengthSignals.source,"gi"))||[]).length;
  if(endurance===strength)return {modality:endurance>1?"endurance":"strength",confidence:"low"};
  return {modality:endurance>strength?"endurance":"strength",confidence:Math.max(endurance,strength)>=3?"high":"medium"};
}

const parsePrescription=(line:string)=>{
  const match=line.match(/(?:^|\s)(\d+)\s*(?:x|×)\s*(\d+(?:\s*[-–]\s*\d+)?)(?:\s*(?:reps?))?/i);
  if(!match)return {};
  return {sets:Number(match[1]),reps:match[2].replace(/\s+/g,"").replace("–","-"),start:match.index||0,end:(match.index||0)+match[0].length};
};

function parseStrength(payload:ImportSessionPayload,text:string,catalogue:Exercise[]):{draft:StrengthImportDraft;issues:ImportIssue[]}{
  const lines=text.split(/\r?\n/).map(cleanLine).filter(Boolean);const issues:ImportIssue[]=[];const exercises:ImportedStrengthExercise[]=[];const guidance:string[]=[];const groups:Record<string,string>={};let activeGroup:string|undefined;let groupCounter=0;
  const headingPattern=/^(?:super\s*set|superset|circuit)(?:\s+([a-z0-9]+))?(?:\s*[:—-]\s*(.+))?$/i;
  let title="Imported strength workout";
  const first=lines[0];if(first&&!parsePrescription(first).sets&&!headingPattern.test(first)&&!strengthSignals.test(first))title=first;
  for(const [lineIndex,line] of lines.entries()){
    if(line===title&&lineIndex===0)continue;
    const heading=line.match(headingPattern);if(heading){activeGroup=`import-group-${groupCounter++}`;groups[activeGroup]=heading[2]?.trim()||`Superset ${String.fromCharCode(65+groupCounter-1)}`;continue}
    const prefix=line.match(/^([A-Z])(\d+)[.)]?\s+(.+)$/);const content=prefix?prefix[3]:line;
    if(/^(?:rest|tempo|notes?|instructions?|warm[ -]?up)\b/i.test(content)&&!parsePrescription(content).sets){guidance.push(content);issues.push({id:`guidance-${lineIndex}`,severity:"info",code:"preserved_guidance",message:`Preserved as workout guidance: “${content}”`});continue}
    if(prefix){const key=`import-group-${prefix[1].toLowerCase()}`;activeGroup=key;groups[key]=`Superset ${prefix[1]}`}
    const prescription=parsePrescription(content);let name=content;
    if(prescription.sets!=null)name=(content.slice(0,prescription.start)+" "+content.slice(prescription.end)).trim();
    name=name.replace(/\s*(?:@|,|—|-)?\s*(?:\d+(?:\.\d+)?\s*kg|rpe\s*\d+(?:\.\d+)?|rir\s*\d+|rest\s*\d+\s*(?:s|sec|secs|seconds?|min|mins|minutes?)|tempo\s*[\d-]+).*$/i,"").replace(/[:—-]+$/g,"").trim();
    if(!name||!(/[a-z]/i.test(name))){guidance.push(content);issues.push({id:`unparsed-${lineIndex}`,severity:"warning",code:"unparsed_instruction",message:`Review this unparsed instruction: “${content}”`});continue}
    const match=matchExercise(name,catalogue);const itemId=id("import-exercise",lineIndex);
    const noteParts:string[]=[];const detail=content.slice(Math.max(prescription.end||0,name.length)).replace(/^\s*[,—:@-]+\s*/,"").trim();if(detail)noteParts.push(detail);
    const item:ImportedStrengthExercise={id:itemId,rawName:name,exerciseId:match.exercise?.id,matchStatus:match.status,suggestions:match.suggestions,sets:prescription.sets,reps:prescription.reps||"",notes:noteParts.join(" · "),groupKey:activeGroup,groupLabel:activeGroup?groups[activeGroup]:undefined};exercises.push(item);
    if(match.status!=="matched")issues.push({id:`match-${itemId}`,severity:"warning",code:"exercise_match",itemId,message:match.status==="unmatched"?`“${name}” was not found in your exercise library.`:`Please confirm which exercise “${name}” means.`});
    if(item.sets==null||!item.reps)issues.push({id:`prescription-${itemId}`,severity:"warning",code:"missing_prescription",itemId,message:`Check the sets and reps for “${name}”.`});
    if(!prefix&&activeGroup&&exercises.length>1&&/^(warm|cool|notes?|focus)/i.test(name))activeGroup=undefined;
  }
  if(!exercises.length)issues.push({id:"no-exercises",severity:"error",code:"no_exercises",message:"No strength exercises could be identified. Try putting each exercise on a new line."});
  return {draft:{kind:"strength",name:title,focus:guidance.join(" · "),exercises,supersetNames:groups},issues};
}

const activityFrom=(text:string):TrainingActivityType=>/swim|\/\s*100\s*m/i.test(text)?"swim":/row|\/\s*500\s*m/i.test(text)?"row":/ride|bike|cycling|watt/i.test(text)?"bike":/walk|hike/i.test(text)?"walk_hike":/elliptical/i.test(text)?"elliptical":/cross.?train/i.test(text)?"cross_training":"run";
const secondsFrom=(value:number,unit:string)=>/h(?:our|r)?s?/i.test(unit)?value*3600:/min/i.test(unit)?value*60:value;
const completionFrom=(line:string):{completionType:TrainingCompletionType;distanceMetres?:number;durationSeconds?:number}=>{
  if(/(?:lap press|lap button|until lap)/i.test(line))return {completionType:"lap_button"};
  if(/\bopen\b/i.test(line))return {completionType:"open"};
  const distance=line.match(/(\d+(?:\.\d+)?)\s*(km|m(?:etre)?s?)\b/i);if(distance)return {completionType:"distance",distanceMetres:Number(distance[1])*(distance[2].toLowerCase()==="km"?1000:1)};
  const duration=line.match(/(\d+(?:\.\d+)?)\s*(hours?|hrs?|h|minutes?|mins?|min|seconds?|secs?|sec|s)\b/i);if(duration)return {completionType:"time",durationSeconds:secondsFrom(Number(duration[1]),duration[2])};
  return {completionType:"open"};
};
const targetFrom=(line:string):Partial<TrainingSessionBlock>=>{
  const hrZone=line.match(/(?:hr|heart.?rate)\s*(?:zone|z)\s*(\d)/i);if(hrZone)return {targetMetric:"heart_rate_zone",targetMinValue:Number(hrZone[1]),targetMaxValue:Number(hrZone[1]),targetUnit:"zone",intensityTarget:hrZone[0]};
  const powerZone=line.match(/(?:power\s*)?(?:zone|z)\s*(\d)/i);if(powerZone&&/power|watt/i.test(line))return {targetMetric:"power_zone",targetMinValue:Number(powerZone[1]),targetMaxValue:Number(powerZone[1]),targetUnit:"zone",intensityTarget:powerZone[0]};
  const watts=line.match(/(\d+)\s*(?:[-–]\s*(\d+)\s*)?w(?:atts?)?/i);if(watts)return {targetMetric:"power",targetMinValue:Number(watts[1]),targetMaxValue:Number(watts[2]||watts[1]),targetUnit:"W",intensityTarget:watts[0]};
  const rpe=line.match(/rpe\s*(\d+(?:\.\d+)?)/i);if(rpe)return {targetMetric:"rpe",targetMinValue:Number(rpe[1]),targetMaxValue:Number(rpe[1]),targetUnit:"RPE",intensityTarget:rpe[0]};
  const cadence=line.match(/(\d+)\s*(?:[-–]\s*(\d+)\s*)?rpm/i);if(cadence)return {targetMetric:"cadence",targetMinValue:Number(cadence[1]),targetMaxValue:Number(cadence[2]||cadence[1]),targetUnit:"rpm",intensityTarget:cadence[0]};
  const zone=line.match(/(?:pace\s*)?(?:zone|z)\s*(\d)/i);if(zone)return {targetMetric:"heart_rate_zone",targetMinValue:Number(zone[1]),targetMaxValue:Number(zone[1]),targetUnit:"zone",intensityTarget:zone[0]};
  const pace=line.match(/(\d{1,2}):(\d{2})(?:\s*[-–]\s*(\d{1,2}):(\d{2}))?\s*\/(km|500\s*m|100\s*m)/i);if(pace){const low=Number(pace[1])*60+Number(pace[2]),high=pace[3]?Number(pace[3])*60+Number(pace[4]):low;return {targetMetric:"pace",targetMinValue:Math.min(low,high),targetMaxValue:Math.max(low,high),targetUnit:`s/${pace[5].replace(/\s/g,"")}`,intensityTarget:pace[0]}}
  if(/easy|conversational|free effort/i.test(line))return {targetMetric:"effort",targetUnit:"effort",intensityTarget:(line.match(/easy|conversational|free effort/i)||[])[0]};
  return {};
};
const roleFrom=(line:string):TrainingBlockType=>/warm[ -]?up/i.test(line)?"warmup":/cool[ -]?down/i.test(line)?"cooldown":/recovery/i.test(line)?"recovery":/\brest\b/i.test(line)?"rest":/interval|work/i.test(line)?"interval":"main";

function parseEndurance(payload:ImportSessionPayload,text:string):{draft:EnduranceImportDraft;issues:ImportIssue[]}{
  const lines=text.split(/\r?\n/).map(cleanLine).filter(Boolean);const issues:ImportIssue[]=[];const activityType=activityFrom(text);const title=lines[0]&&!/^\d|warm|cool|repeat/i.test(lines[0])?lines[0]:`Imported ${activityType.replace("_"," ")} workout`;const content=lines[0]===title?lines.slice(1):lines;const blocks:TrainingSessionBlock[]=[];let parentId:string|undefined;
  for(const [index,line] of content.entries()){
    const repeatOnly=line.match(/^(?:repeat\s*)?(\d+)\s*(?:x|×)\s*:?[ ]*$/i);
    const repeatedStep=line.match(/^(\d+)\s*(?:x|×)\s+(.+)$/i);
    if(repeatOnly){const groupId=id("repeat",index);blocks.push({id:groupId,parentId,type:"repeat_group",title:"Repeat",instructions:"",repetitions:Number(repeatOnly[1]),completionType:"open"});parentId=groupId;continue}
    if(/cool[ -]?down/i.test(line))parentId=undefined;
    if(repeatedStep){const groupId=id("repeat",index);blocks.push({id:groupId,type:"repeat_group",title:"Repeat",instructions:"",repetitions:Number(repeatedStep[1]),completionType:"open",parentId});const stepLine=repeatedStep[2];const completion=completionFrom(stepLine);blocks.push({id:id("step",index),parentId:groupId,type:roleFrom(stepLine),title:roleFrom(stepLine)==="main"?"Work":roleFrom(stepLine).replace(/^./,letter=>letter.toUpperCase()),instructions:stepLine,...completion,...targetFrom(stepLine)});const recovery=stepLine.match(/(?:,|with)\s*(\d+(?:\.\d+)?)\s*(sec(?:ond)?s?|min(?:ute)?s?)\s*(?:rest|recovery)/i);if(recovery)blocks.push({id:id("recovery",index),parentId:groupId,type:"recovery",title:"Recovery",instructions:"",completionType:"time",durationSeconds:secondsFrom(Number(recovery[1]),recovery[2])});continue}
    const completion=completionFrom(line);const role=roleFrom(line);blocks.push({id:id("step",index),parentId,type:role,title:role==="main"?"Work":role.replace(/^./,letter=>letter.toUpperCase()).replace("Cooldown","Cool-down"),instructions:line,...completion,...targetFrom(line)});
  }
  const topLevel=blocks.filter(block=>!block.parentId&&block.type!=="repeat_group");const plannedDistance=topLevel.reduce((sum,block)=>sum+(block.distanceMetres||0),0);const plannedDuration=topLevel.reduce((sum,block)=>sum+(block.durationSeconds||0),0);
  if(!blocks.length)issues.push({id:"no-steps",severity:"warning",code:"simple_session",message:"No structured steps were found. You can keep this as a simple session or add structure during review."});
  if(activityType==="run"&&!/run|running|pace|\/km/i.test(text))issues.push({id:"confirm-sport",severity:"warning",code:"confirm_activity",message:"Please confirm the activity type. Run has been selected as the default."});
  const template:EnduranceTemplate={id:`endurance-template-import-${Date.now()}`,activityType,title,plannedDistanceKm:plannedDistance?plannedDistance/1000:undefined,plannedDurationMinutes:plannedDuration?plannedDuration/60:undefined,notes:"",blocks};
  return {draft:{kind:"endurance",template},issues};
}

export function parseImportSession(payload:ImportSessionPayload,text:string,catalogue:Exercise[],hint?:ImportModality):ImportParseResult{
  const detected=detectModality(text,hint);const parsed=detected.modality==="strength"?parseStrength(payload,text,catalogue):parseEndurance(payload,text);
  const issues=[...parsed.issues];if(detected.confidence==="low")issues.unshift({id:"low-confidence",severity:"warning",code:"low_confidence",message:"The workout type was not completely clear. Please check it before saving."});
  return {payload:{...payload,rawText:text},modality:detected.modality,confidence:detected.confidence,issues,draft:parsed.draft};
}
