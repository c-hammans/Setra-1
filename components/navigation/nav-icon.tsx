export type NavIconName="today"|"plan"|"history"|"pbs"|"premium";

export function NavIcon({name}:{name:NavIconName}){
  const bars=<><rect x="5" y="3" width="18" height="5" rx="2.5"/><rect x="5" y="11.5" width="18" height="5" rx="2.5"/><rect x="5" y="20" width="18" height="5" rx="2.5"/></>;
  return <span className={`nav-icon nav-icon-${name}`} aria-hidden="true"><svg viewBox="0 0 32 28" role="img">
    {name==="today"&&bars}
    {name==="plan"&&<><circle cx="4" cy="5.5" r="2.5"/><circle cx="4" cy="14" r="2.5"/><circle cx="4" cy="22.5" r="2.5"/><rect x="9" y="3" width="18" height="5" rx="2.5"/><rect x="9" y="11.5" width="18" height="5" rx="2.5"/><rect x="9" y="20" width="18" height="5" rx="2.5"/></>}
    {name==="history"&&<><rect x="3" y="3" width="17" height="5" rx="2.5"/><rect x="3" y="11.5" width="17" height="5" rx="2.5"/><rect x="3" y="20" width="17" height="5" rx="2.5"/><path d="M22.5 5.2h-5.1m0 0 3.5-3.3m-3.5 3.3 3.5 3.2M22 5.4c4.5.8 7 4.2 7 8.7 0 5.5-3.4 9.1-8.5 9.7" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/></>}
    {name==="pbs"&&<><rect x="2" y="3" width="17" height="5" rx="2.5"/><rect x="2" y="11.5" width="15" height="5" rx="2.5"/><rect x="2" y="20" width="17" height="5" rx="2.5"/><path d="m23.2 7 2.1 4.2 4.7.7-3.4 3.3.8 4.7-4.2-2.2-4.2 2.2.8-4.7-3.4-3.3 4.7-.7Z"/></>}
    {name==="premium"&&<><rect x="2" y="3" width="17" height="5" rx="2.5"/><rect x="2" y="11.5" width="15" height="5" rx="2.5"/><rect x="2" y="20" width="17" height="5" rx="2.5"/><path d="M24 6.2c.8 4.1 2.4 6.1 6 7-3.6.9-5.2 2.9-6 7-.8-4.1-2.4-6.1-6-7 3.6-.9 5.2-2.9 6-7Z"/></>}
  </svg></span>;
}
