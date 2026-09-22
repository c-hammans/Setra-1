import {ActivityIcon} from "@/components/endurance/activity-icon";
import {activityLabel} from "@/components/endurance/endurance-session-sheet";
import type {Exercise,TrainingActivityType} from "@/lib/setra/types";
import {formatLoad,type StrengthUnit} from "@/lib/setra/units";
import {progressBarPercent,progressCoverage} from "@/lib/setra/progress";

type ProgressWeek={key:string;label:string;sessions:number;strength:number;endurance:number;minutes:number;durationCoverage:number;distance:number};
type StrengthTrend={exercise:Exercise;first:{date:string;max:number;reps:string};last:{date:string;max:number;reps:string};change:number};
type EnduranceTrend={activityType:TrainingActivityType;sessions:number;distance:number;minutes:number;hasDistance:boolean;hasTime:boolean};

const dateLabel=(value:string)=>new Intl.DateTimeFormat("en-AU",{day:"numeric",month:"short",year:"numeric"}).format(new Date(`${value}T12:00:00`));
const minutesLabel=(minutes:number)=>minutes>=60?`${Math.floor(minutes/60)}h ${Math.round(minutes%60)}m`:`${Math.round(minutes)}m`;

export function ProgressOverview({weeks,showStrength,showEndurance,strengthTrends,enduranceTrends,preferredUnit,onExercise}:{weeks:ProgressWeek[];showStrength:boolean;showEndurance:boolean;strengthTrends:StrengthTrend[];enduranceTrends:EnduranceTrend[];preferredUnit:StrengthUnit;onExercise:(id:string)=>void}){
  const maxSessions=Math.max(1,...weeks.map(week=>week.sessions));
  const coverage=progressCoverage(weeks);
  const period=`${weeks.at(0)?.label??""} – ${weeks.at(-1)?.label??""}`;
  return <section className="progress-overview" aria-label="Training progress">
    <div className="progress-section-heading"><span>LAST SIX WEEKS</span><h2>The work adds up.</h2><p>{period}. Completed training only; missing duration or distance remains unknown.</p></div>
    <div className="weekly-progress-bars" role="img" aria-label={`Completed sessions by week from ${period}`}>
      {weeks.map(week=><div className={week.sessions===0?"zero-week":""} key={week.key} title={`${week.sessions} ${week.sessions===1?"session":"sessions"}`}><span style={{height:`${progressBarPercent(week.sessions,maxSessions)}%`}}/><b>{week.sessions}</b><small>{week.label}</small><i className="sr-only">{week.sessions} completed {week.sessions===1?"session":"sessions"}; duration {week.durationCoverage?`${minutesLabel(week.minutes)} recorded for ${week.durationCoverage} of ${week.sessions}`:"not recorded"}; endurance distance {week.distance?`${Number(week.distance.toFixed(1))} kilometres`:"not recorded"}.</i></div>)}
    </div>
    <p className="progress-coverage">{coverage.sessions===0?"No completed sessions in this six-week period.":`Duration recorded for ${coverage.durationRecorded} of ${coverage.sessions} completed ${coverage.sessions===1?"session":"sessions"}.`}</p>
    {showStrength&&<div className="progress-group"><span>STRENGTH · HIGHEST RECORDED KG LOAD</span>{strengthTrends.length?strengthTrends.map(item=><button key={item.exercise.id} onClick={()=>onExercise(item.exercise.id)}><b>{item.exercise.name}</b><small>{formatLoad(item.first.max,preferredUnit)} × {item.first.reps||"reps not recorded"} on {dateLabel(item.first.date)} → {formatLoad(item.last.max,preferredUnit)} × {item.last.reps||"reps not recorded"} on {dateLabel(item.last.date)}</small><em>{item.change===0?"Same highest load":`${item.change>0?"+":""}${formatLoad(item.change,preferredUnit)}`}</em></button>):<p>Complete the same exercise with a numeric load in at least two sessions to compare its highest recorded loads. This does not measure overall strength progress.</p>}</div>}
    {showEndurance&&<div className="progress-group"><span>ENDURANCE · LIFETIME RECORDED TOTALS</span>{enduranceTrends.length?enduranceTrends.map(item=><div key={item.activityType}><ActivityIcon type={item.activityType}/><p><b>{activityLabel(item.activityType)}</b><small>{item.sessions} {item.sessions===1?"completed session":"completed sessions"}</small></p><em>{[item.hasDistance?`${Number(item.distance.toFixed(1))} km recorded`:"distance unknown",item.hasTime?`${minutesLabel(item.minutes)} recorded`:"duration unknown"].join(" · ")}</em></div>):<p>Complete an endurance activity with recorded distance or duration to begin building totals.</p>}</div>}
  </section>;
}
