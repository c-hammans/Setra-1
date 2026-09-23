export type ProgressWeekSummary={sessions:number;durationCoverage:number;endurance?:number;distanceCoverage?:number};

export function progressBarPercent(sessions:number,maxSessions:number){
  if(sessions<=0)return 0;
  return Math.max(10,(sessions/Math.max(1,maxSessions))*100);
}

export function progressCoverage(weeks:ProgressWeekSummary[]){
  return weeks.reduce((summary,week)=>({sessions:summary.sessions+week.sessions,durationRecorded:summary.durationRecorded+week.durationCoverage,enduranceSessions:summary.enduranceSessions+(week.endurance||0),distanceRecorded:summary.distanceRecorded+(week.distanceCoverage||0)}),{sessions:0,durationRecorded:0,enduranceSessions:0,distanceRecorded:0});
}
