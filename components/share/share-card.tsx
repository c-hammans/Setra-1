import type {CSSProperties} from "react";
import type {ShareCardData,ShareRenderOptions} from "@/lib/share/share-types";

function ShareBrand(){return <span className="share-brand"><i/><b>setra</b></span>}

export function ShareCard({data,options}:{data:ShareCardData;options:ShareRenderOptions}){
  const background:CSSProperties=options.background==="solid"?{background:options.accent}:options.background==="gradient"?{background:`linear-gradient(145deg,color-mix(in srgb,${options.accent} 78%,white),color-mix(in srgb,${options.accent} 62%,#0f172a))`}:{};
  const style={...background,"--share-accent":options.accent,"--share-photo-x":`${options.photoX}%`,"--share-photo-y":`${options.photoY}%`} as CSSProperties;
  return <div className={`share-card share-format-${options.format} share-background-${options.background} share-tone-${options.textTone}`} style={style}>
    {/* A local object URL cannot be passed through Next Image optimisation. */}
    {/* eslint-disable-next-line @next/next/no-img-element */}
    {options.background==="photo"&&options.photoUrl?<img className="share-background-photo" src={options.photoUrl} alt="Selected share background"/>:null}
    {options.background==="photo"?<span className="share-photo-shade"/>:null}
    <div className="share-information-layer">
      <header><ShareBrand/><span>{data.label}</span></header>
      {options.format==="sticker"?<CompactShareSticker data={data}/>:data.kind==="pb"?<PBShareCard data={data}/>:<WorkoutShareCard data={data}/>} 
    </div>
  </div>
}

export function WorkoutShareCard({data}:{data:ShareCardData}){return <div className="share-workout-content"><div className="share-result"><small>{data.title}</small><strong>{data.result}</strong>{data.secondary?<span>{data.secondary}</span>:null}</div><div className="share-metrics">{data.metrics.map(metric=><p key={`${metric.label}-${metric.value}`}><b>{metric.value}</b><span>{metric.label}</span></p>)}</div>{data.date?<time>{new Intl.DateTimeFormat("en-AU",{day:"numeric",month:"short",year:"numeric"}).format(new Date(`${data.date}T12:00:00`))}</time>:null}</div>}

export function PBShareCard({data}:{data:ShareCardData}){return <div className="share-pb-content"><small>{data.title}</small><strong>{data.result}</strong>{data.secondary?<span>{data.secondary}</span>:null}{data.improvement?<b>{data.improvement}</b>:null}{data.previous?<p>{data.previous}</p>:null}</div>}

export function CompactShareSticker({data}:{data:ShareCardData}){const strengthHero=data.kind==="workout"&&data.sport==="strength"?data.metrics[0]?.value:data.result;const metrics=data.kind==="workout"&&data.sport==="strength"?data.metrics.slice(1,3):data.metrics.slice(0,2);return <div className="share-sticker-content"><div><small>{data.title}</small><strong>{strengthHero||data.result}</strong>{data.secondary?<span>{data.secondary}</span>:null}</div><div className="share-sticker-metrics">{metrics.map(metric=><p key={`${metric.label}-${metric.value}`}><b>{metric.value}</b><span>{metric.label}</span></p>)}</div></div>}

export function SharePreview({data,options}:{data:ShareCardData;options:ShareRenderOptions}){return <div className={`share-preview share-preview-${options.format} ${options.background==="transparent"?"shows-transparency":""}`}><ShareCard data={data} options={options}/></div>}
