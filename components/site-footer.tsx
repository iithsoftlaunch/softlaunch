import Link from 'next/link';
import { SITE } from '@/lib/site';

export default function SiteFooter() {
  return (
    <footer className="site wrap">
      <div className="fmark">
        {SITE.wordmark[0]}
        <b> {SITE.wordmark[1]}</b>
      </div>
      <div className="fdates">
        signup 17–21 sep · picking 23 sep · reveal 24 sep, 12:01 am
      </div>
      <div className="fnav">
        <Link href="/how-it-works">How it works</Link>
        <Link href="/how-it-works#privacy">Privacy</Link>
        <Link href="/wall">Couples wall</Link>
      </div>
      <p className="dim" style={{ fontSize: 13, maxWidth: '44ch', margin: '22px auto 0' }}>
        A little experiment in finding out, made for {SITE.campus}. Built so the
        only person who can break your secret is the one who shares it.
      </p>
    </footer>
  );
}
