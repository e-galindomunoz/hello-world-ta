import Link from "next/link";
import { GoogleSignIn } from "@/components/google-sign-in";
import { BrandMark, Icon } from "@/components/icons";
import { ThemeToggle } from "@/components/theme-toggle";

export function Landing({ signedIn = false, configured, login = false }: {
  signedIn?: boolean;
  configured: boolean;
  login?: boolean;
}) {
  return (
    <div className="landing">
      <header className="landing-header">
        <Link href={signedIn ? "/feed" : "/"} className="wordmark">
          <BrandMark /><span>LetsBeGoofy</span>
        </Link>
        <div className="landing-header-actions"><Link href="/feed">Take a look around <Icon name="arrow" /></Link><ThemeToggle /></div>
      </header>
      <main className="landing-main">
        <div className="landing-invitation">
          <span className="hero-eyebrow">A place for your questionable moments</span>
          <h1>{login ? <>Back for<br /><em>more?</em></> : <>Life is weird.<br /><em>Bring proof.</em></>}</h1>
          <p className="landing-tagline">Your camera roll has some explaining to do. Drop a photo. We’ll caption the chaos. Let everyone react.</p>
          <div className="landing-cta">
            {signedIn ? <Link className="button" href="/dashboard">I’ve got something <Icon name="camera" /></Link> : (
              <div className="landing-signin">
                {configured ? <GoogleSignIn /> : <p role="status">Sign-in is not available yet. Check back soon.</p>}
                <span className="sign-in-note">Come on in. Bring your sense of humor.</span>
              </div>
            )}
          </div>
          <ol className="social-loop" aria-label="How LetsBeGoofy works">
            <li><Icon name="camera" /> Upload</li><li><Icon name="spark" /> Caption</li><li><Icon name="arrow" /> Post</li><li><Icon name="flame" /> React</li>
          </ol>
        </div>
        <div className="landing-scene" aria-label="Illustrated example of a moment and its caption">
          <span className="scene-sticker">exhibit A: a Tuesday</span>
          <figure className="example-post">
            <div className="example-moment">
              <svg viewBox="0 0 480 350" role="img" aria-label="Illustration of a tipped-over coffee cup spilling onto a table">
                <rect width="480" height="350" fill="#ded2c0" />
                <path d="M0 255 480 188v162H0Z" fill="#c4b09a" />
                <ellipse cx="277" cy="250" rx="136" ry="44" fill="#715446" />
                <ellipse cx="281" cy="245" rx="109" ry="30" fill="#8b6551" />
                <g transform="rotate(-28 186 192)">
                  <path d="M244 152h28c41 0 40 63 0 63h-23" fill="none" stroke="#f9f5ef" strokeWidth="22" />
                  <path d="M123 112h137l-13 114q-54 42-111 0Z" fill="#f9f5ef" />
                  <ellipse cx="191" cy="114" rx="68" ry="20" fill="#b99ae1" />
                  <ellipse cx="191" cy="112" rx="54" ry="12" fill="#49382f" />
                  <path d="M157 175q8-13 16 0m25-2q8-13 16 0m-47 27q19-12 35 0" fill="none" stroke="#463b55" strokeWidth="7" strokeLinecap="round" />
                </g>
                <path d="m332 143 17-22m-1 49 25-5m-63-37 4-22" stroke="#7d6798" strokeWidth="7" strokeLinecap="round" />
                <ellipse cx="407" cy="273" rx="12" ry="7" fill="#715446" />
                <ellipse cx="118" cy="278" rx="17" ry="8" fill="#715446" />
              </svg>
              <span className="moment-label">Something happened.</span>
            </div>
            <figcaption>my coffee also decided<br />to leave the meeting.</figcaption>
            <div className="example-reaction"><span><Icon name="thumbUp" /> Would laugh again.</span><span>Illustrated example</span></div>
          </figure>
          <div className="scene-reply"><span aria-hidden="true">✦</span> okay but why is this me</div>
          <div className="scene-mascot" aria-hidden="true">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/app_icon_navy.svg" alt="" width={100} height={100} />
          </div>
        </div>
      </main>
      <footer className="landing-footer"><span>LetsBeGoofy. It’s a group thing.</span><Link href="/feed">See what everyone’s up to <Icon name="arrow" /></Link></footer>
    </div>
  );
}
