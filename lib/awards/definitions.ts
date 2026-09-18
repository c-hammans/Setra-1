import type {AchievementDefinition,AwardCategory,AwardMetric} from "./types.ts";

const award=(id:string,category:AwardCategory,title:string,description:string,metric:AwardMetric,threshold:number,icon:string,options:Partial<AchievementDefinition>={}):AchievementDefinition=>({id,category,title,description,requirement:description,metric,threshold,icon,shareable:true,...options});
const milestones=(prefix:string,category:AwardCategory,metric:AwardMetric,values:number[],title:(value:number)=>string,description:(value:number)=>string,icon:string,unit?:string)=>values.map(value=>award(`${prefix}_${value}`,category,title(value),description(value),metric,value,icon,{unit}));

export const achievementDefinitions:AchievementDefinition[]=[
  award("first_session","training","First Step","Complete your first Setra session.","sessions_completed",1,"flag"),
  award("first_strength","strength","Under Load","Complete your first strength session.","first_strength",1,"strength"),
  award("first_endurance","endurance","On the Move","Complete your first endurance session.","first_endurance",1,"endurance"),
  award("first_planned_completion","training","As Planned","Complete a session from your training plan.","first_planned_completion",1,"calendar"),
  award("first_template","setra","Blueprint","Create your first reusable workout template.","templates_created",1,"template"),
  award("first_full_planned_week","consistency","Week in the Bank","Complete every due session in a planned training week.","first_full_planned_week",1,"week"),
  ...milestones("sessions","training","sessions_completed",[5,10,25,50,100,250,500,1000],value=>value===50?"Half Century":value===100?"Century":`${value} Sessions`,value=>`Complete ${value} training sessions.`,"sessions","sessions"),
  ...milestones("active_weeks","consistency","active_week_streak",[2,4,8,12,26,52,104],value=>`${value} Active Weeks`,value=>`Train in ${value} consecutive configured weeks.`,"week","weeks"),
  ...milestones("weekly_goal","consistency","weekly_goal_streak",[2,4,8,12,26,52],value=>`${value} Goal Weeks`,value=>`Meet your weekly session goal for ${value} consecutive weeks.`,"target","weeks"),
  ...milestones("planned_weeks","consistency","planned_week_streak",[2,4,8,12,26,52],value=>`${value} Planned Weeks`,value=>`Complete every due planned session for ${value} consecutive weeks.`,"calendar-check","weeks"),
  ...milestones("training_days","consistency","training_day_streak",[2,3,5,7,10],value=>`${value} Training Days`,value=>`Complete training on ${value} consecutive calendar days.`,"bolt","days"),
  ...milestones("setra_days","setra","setra_use_streak",[3,7,14,30,60,100,365],value=>`${value} Days with Setra`,value=>`Use Setra on ${value} consecutive local calendar days.`,"setra","days"),
  ...milestones("hours","training","training_hours",[10,25,50,100,250,500,1000],value=>`${value} Training Hours`,value=>`Record ${value} hours of completed training.`,"clock","hours"),
  ...milestones("run_km","endurance","run_distance_km",[25,50,100,250,500,1000,2500,5000],value=>`${value.toLocaleString()} km Run`,value=>`Record ${value.toLocaleString()} kilometres of running.`,"run","km"),
  ...milestones("bike_km","endurance","bike_distance_km",[100,250,500,1000,2500,5000,10000,25000],value=>`${value.toLocaleString()} km Ridden`,value=>`Record ${value.toLocaleString()} kilometres of cycling.`,"bike","km"),
  ...milestones("swim_km","endurance","swim_distance_km",[5,10,25,50,100,250,500],value=>`${value.toLocaleString()} km Swum`,value=>`Record ${value.toLocaleString()} kilometres of swimming.`,"swim","km"),
  ...milestones("row_km","endurance","row_distance_km",[10,25,50,100,250,500,1000],value=>`${value.toLocaleString()} km Rowed`,value=>`Record ${value.toLocaleString()} kilometres of rowing.`,"row","km"),
  ...milestones("walk_km","endurance","walk_distance_km",[25,50,100,250,500,1000],value=>`${value.toLocaleString()} km on Foot`,value=>`Record ${value.toLocaleString()} kilometres of walking or hiking.`,"walk","km"),
  ...milestones("volume_kg","strength","strength_volume_kg",[10000,50000,100000,250000,500000,1000000],value=>`${value.toLocaleString()} kg Lifted`,value=>`Record ${value.toLocaleString()} kilograms of completed strength volume.`,"strength","kg"),
  ...milestones("hybrid_weeks","hybrid","hybrid_weeks",[1,4,12,26,52],value=>value===1?"Hybrid Week":`${value} Hybrid Weeks`,value=>`Complete strength and endurance training in ${value} configured week${value===1?"":"s"}.`,"hybrid","weeks"),
  award("early_sessions_5","special","Early Bird","Complete five sessions before 7:00 am.","early_sessions",5,"sunrise"),
  award("late_sessions_5","special","Night Shift","Complete five sessions from 9:00 pm.","late_sessions",5,"moon"),
  award("weekends_10","special","Weekend Work","Train on ten different weekend days.","weekends_trained",10,"weekend"),
  award("variety_4","special","Range","Complete four different endurance activity types, or strength plus three endurance types.","activity_variety",4,"variety"),
  award("double_days_5","special","Double Day","Complete two distinct sessions in one day on five occasions.","double_days",5,"double"),
  award("back_at_it","special","Back At It","Complete a session after at least 21 days away.","back_at_it",1,"return"),
  award("secret_before_dawn","special","First Light","Complete a session before 5:30 am.","early_sessions",1,"sunrise",{secret:true,requirement:"Hidden achievement"}),
  award("secret_all_rounder","special","All Terrain","Record five different training activity types.","activity_variety",5,"variety",{secret:true,requirement:"Hidden achievement"}),
];

export const achievementById=new Map(achievementDefinitions.map(item=>[item.id,item]));
export const awardCategoryLabels:Record<AwardCategory,string>={consistency:"Consistency",training:"Training",strength:"Strength",endurance:"Endurance",hybrid:"Hybrid",setra:"Setra",special:"Special"};
