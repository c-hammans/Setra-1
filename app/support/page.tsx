import Link from "next/link";

export default function SupportPage(){return <main className="information-page"><section><Link href="/profile">‹ Profile</Link><small>SUPPORT</small><h1>Get help with Setra</h1><div className="information-notice"><b>Support during beta</b><p>A public support address is not available yet.</p></div><p>During beta testing, use the feedback option on the Today page to report a problem without including passwords or other sensitive information.</p><Link className="information-action" href="/?feedback=1">Share feedback</Link></section></main>}
