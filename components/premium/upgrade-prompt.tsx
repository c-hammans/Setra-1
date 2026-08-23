import Link from "next/link";
export function UpgradePrompt({title="Built for what comes next",body="Join the early-access list for Setra Premium updates."}:{title?:string;body?:string}){return <aside className="upgrade-prompt"><span>SETRA PREMIUM</span><h3>{title}</h3><p>{body}</p><Link href="/premium#early-access">Explore Premium</Link></aside>}
