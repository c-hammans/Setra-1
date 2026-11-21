export function PremiumBadge({compact=false,label="Premium"}:{compact?:boolean;label?:string}){return <span className={`premium-badge ${compact?"compact":""}`}><i>✦</i> {label}</span>}
