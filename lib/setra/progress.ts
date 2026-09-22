export type ProgressWeekSummary={sessions:number;durationCoverage:number};

export function progressBarPercent(sessions:number,maxSessions:number){
  if(sessions<=0)return 0;
  return Math.max(10,(sessions/Math.max(1,maxSessions))*100);
}

export function progressCoverage(weeks:ProgressWeekSummary[]){
  return weeks.reduce((summary,week)=>({sessions:summary.sessions+week.sessions,durationRecorded:summary.durationRecorded+week.durationCoverage}),{sessions:0,durationRecorded:0});
}
