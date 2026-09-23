export type WeekdayIndex=0|1|2|3|4|5|6;

export const weekdayOptions:[WeekdayIndex,string][]=[
  [1,"Monday"],[2,"Tuesday"],[3,"Wednesday"],[4,"Thursday"],[5,"Friday"],[6,"Saturday"],[0,"Sunday"],
];

export const parseLocalDate=(value:string|Date)=>value instanceof Date?new Date(value.getFullYear(),value.getMonth(),value.getDate(),12):new Date(`${value}T12:00:00`);
export const localDateKey=(date=new Date())=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;

/** Adds calendar days without converting a date-only value through UTC. */
export function addCalendarDays(value:string,days:number){
  const date=parseLocalDate(value);
  date.setDate(date.getDate()+days);
  return localDateKey(date);
}

export function recurrenceDateKeys(start:string,intervalDays:number,count:number){
  return Array.from({length:Math.max(0,count)},(_,index)=>addCalendarDays(start,index*intervalDays));
}

export function startOfUserWeek(value:string|Date,weekStartsOn:WeekdayIndex){
  const date=parseLocalDate(value);
  date.setDate(date.getDate()-((date.getDay()-weekStartsOn+7)%7));
  return date;
}

export function weekDateKeys(value:string|Date,weekStartsOn:WeekdayIndex){
  const start=startOfUserWeek(value,weekStartsOn);
  return Array.from({length:7},(_,index)=>{const date=new Date(start);date.setDate(start.getDate()+index);return localDateKey(date)});
}

export const weekStartKey=(value:string|Date,weekStartsOn:WeekdayIndex)=>localDateKey(startOfUserWeek(value,weekStartsOn));
export const dayIndexInUserWeek=(value:string|Date,weekStartsOn:WeekdayIndex)=>(parseLocalDate(value).getDay()-weekStartsOn+7)%7;

export function monthGridDateKeys(value:string|Date,weekStartsOn:WeekdayIndex){
  const selected=parseLocalDate(value);
  const first=new Date(selected.getFullYear(),selected.getMonth(),1,12);
  const start=startOfUserWeek(first,weekStartsOn);
  return Array.from({length:42},(_,index)=>{const date=new Date(start);date.setDate(start.getDate()+index);return localDateKey(date)});
}

export const orderedWeekdayInitials=(weekStartsOn:WeekdayIndex)=>Array.from({length:7},(_,index)=>["S","M","T","W","T","F","S"][(weekStartsOn+index)%7]);
