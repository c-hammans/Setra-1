import type {CSSProperties} from "react";
import type {ShareCardData,ShareMetric,ShareRenderOptions} from "@/lib/share/share-types";

function ShareBrand(){return <span className="share-brand"><i/><b>setra</b></span>}
const displayDate=(date?:string,weekday=false)=>date?new Intl.DateTimeFormat("en-AU",weekday?{weekday:"long"}:{day:"numeric",month:"short",year:"numeric"}).format(new Date(`${date}T12:00:00`)):"";
const Metric=({metric,hero=false}:{metric:ShareMetric;hero?:boolean})=><p className={hero?"share-hero-metric":""}><b>{metric.value}</b><span>{metric.label}</span></p>;

export function ShareCard({data,options}:{data:ShareCardData;options:ShareRenderOptions}){
  const background:CSSProperties=options.background==="solid"?{background:options.accent}:options.background==="gradient"?{background:`linear-gradient(145deg,color-mix(in srgb,${options.accent} 78%,white),color-mix(in srgb,${options.accent} 62%,#0f172a))`}:{};
  const style={...background,"--share-accent":options.accent,"--share-photo-x":`${options.photoX}%`,"--share-photo-y":`${options.photoY}%`} as CSSProperties;
  return <div className={`share-card share-format-${options.format} share-background-${options.background} share-tone-${options.textTone} share-kind-${data.kind} share-sport-${data.sport}`} style={style}>
    {/* A local object URL cannot be passed through Next Image optimisation. */}
    {/* eslint-disable-next-line @next/next/no-img-element */}
    {options.background==="photo"&&options.photoUrl?<img className="share-background-photo" src={options.photoUrl} alt="Selected share background"/>:null}
    {options.background==="photo"?<span className="share-photo-shade"/>:null}
    <div className="share-information-layer">
      <header><ShareBrand/><span>{data.label}</span></header>
      {options.format==="sticker"?<CompactShareSticker data={data}/>:data.kind==="pb"?<PBShareCard data={data}/>:data.kind==="award"?<AwardShareCard data={data}/>:<WorkoutShareCard data={data}/>}
    </div>
  </div>;
}

export function WorkoutShareCard({data}:{data:ShareCardData}){
  if(data.sport==="strength"){
    const heroes=data.metrics.slice(0,2),secondary=data.metrics.slice(2,4);
    return <div className="share-workout-content share-strength-session"><div className="share-session-heading"><small>{displayDate(data.date,true)||"Strength session"}</small><h2>{data.title}</h2></div><div className="share-session-heroes">{heroes.map(metric=><Metric hero metric={metric} key={metric.label}/>)}</div>{secondary.length?<div className="share-session-secondary">{secondary.map(metric=><Metric metric={metric} key={metric.label}/>)}</div>:null}{data.date?<time>{displayDate(data.date)}</time>:null}</div>;
  }
  return <div className="share-workout-content share-endurance-session"><div className="share-session-heading"><small>{data.title}</small><h2>{data.result}</h2></div><div className="share-session-secondary">{data.metrics.slice(0,3).map(metric=><Metric metric={metric} key={`${metric.label}-${metric.value}`}/>)}</div>{data.date?<time>{displayDate(data.date)}</time>:null}</div>;
}

export function PBShareCard({data}:{data:ShareCardData}){return <div className="share-pb-content"><small>NEW PB</small><h2>{data.title}</h2><div className="share-pb-result"><strong>{data.result}</strong>{data.secondary?<span>{data.secondary}</span>:null}</div>{data.improvement?<b>{data.improvement}</b>:null}</div>}

export function AwardShareCard({data}:{data:ShareCardData}){return <div className="share-pb-content share-award-content"><small>AWARD EARNED</small><strong>{data.result}</strong><span>{data.title}</span>{data.date?<p>{displayDate(data.date)}</p>:null}</div>}

export function CompactShareSticker({data}:{data:ShareCardData}){
  if(data.kind==="pb")return <div className="share-compact-pb"><small>NEW PB</small><b>{data.title}</b><strong>{data.result}{data.secondary?` ${data.secondary}`:""}</strong>{data.improvement?<em>{data.improvement}</em>:null}</div>;
  if(data.kind==="award")return <div className="share-compact-pb"><small>AWARD EARNED</small><b>{data.result}</b><strong>{data.title}</strong></div>;
  const primary=data.sport==="strength"?data.metrics.slice(0,2):[{label:data.title,value:data.result}],secondary=data.sport==="strength"?data.metrics.slice(2,4):data.metrics.slice(0,2);
  return <div className="share-compact-session"><div className="share-compact-title"><small>{displayDate(data.date,true)||data.label}</small><b>{data.title}</b></div><div className="share-compact-primary">{primary.map(metric=><Metric hero metric={metric} key={`${metric.label}-${metric.value}`}/>)}</div>{secondary.length?<div className="share-compact-secondary">{secondary.map(metric=><Metric metric={metric} key={`${metric.label}-${metric.value}`}/>)}</div>:null}</div>;
}

export function SharePreview({data,options}:{data:ShareCardData;options:ShareRenderOptions}){return <div className={`share-preview share-preview-${options.format} ${options.background==="transparent"?"shows-transparency":""}`}><ShareCard data={data} options={options}/></div>}
