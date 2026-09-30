import Link from "next/link";
import { GoogleSignIn } from "@/components/google-sign-in";
import { BrandMark, Icon } from "@/components/icons";
import { ThemeToggle } from "@/components/theme-toggle";

export function Landing({ signedIn = false, configured, login = false }: { signedIn?: boolean; configured: boolean; login?: boolean }) {
  return <div className="landing">
    <header className="landing-header"><Link href="/" className="wordmark"><BrandMark /><span>LetsBeGoofy<span className="brand-dot">.</span></span></Link><div className="landing-header-actions"><span className="small-note">A little more you.</span><ThemeToggle /></div></header>
    <main className="landing-main">
      <section className="hero-copy"><span className="eyebrow"><span className="status-dot" /> YOUR SPACE. YOUR KIND OF GOOFY.</span><h1>{login ? <>Good to have<br />you <span className="gradient-text">back.</span></> : <>Life’s serious.<br />Your space<br />can be <span className="gradient-text">goofy.</span></>}</h1><p className="hero-description">A home for your favorite finds and a profile that feels like you. Settle in, find your next roast, and make it your own.</p>
        <div className="sign-in-panel glass">{signedIn ? <><span className="sign-in-title">Your space is ready.</span><Link className="button" href="/dashboard">Open dashboard <Icon name="arrow" /></Link></> : <><span className="sign-in-title">{login ? "Welcome back to LetsBeGoofy" : "Good things start with a hello."}</span>{configured ? <div className="google-control"><GoogleSignIn /></div> : <p role="status">Sign-in is not available yet. Please check back soon.</p>}<span className="sign-in-note"><Icon name="lock" /> Your Google account. One simple sign-in.</span></>}</div>
        <div className="hero-details"><span><Icon name="check" /> A space of your own</span><span><Icon name="check" /> A little everyday delight</span></div>
      </section>
      <div className="hero-visual" aria-hidden="true"><div className="orb orb-one" /><div className="orb orb-two" /><div className="visual-grid" /><div className="floating-tag glass"><span className="tag-icon"><Icon name="spark" /></span>A little personality goes a long way.</div><div className="preview-card glass"><div className="preview-top"><span className="mini-wordmark"><BrandMark /> Your personal space</span><span className="preview-dots">•••</span></div><div className="smile-avatar"><BrandMark /></div><span className="preview-badge">100% YOU</span><h2>Stay curious.<br />Be a little goofy.</h2><p>Good coffee. Great company.<br />A space to call your own.</p><div className="preview-divider" /><div className="preview-bottom"><span><Icon name="coffee" /> Everyday favorites</span><span className="round-arrow"><Icon name="arrow" /></span></div></div><div className="floating-bottom glass"><span className="status-dot" /> Less ordinary. More you.</div></div>
    </main>
    <footer className="landing-footer"><span>© {new Date().getFullYear()} LetsBeGoofy</span><span>A small space for a brighter everyday.</span></footer>
  </div>;
}
