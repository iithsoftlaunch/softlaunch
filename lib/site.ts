// Configuration and timeline settings for the Soft Launch platform.

export const SITE = {
  name: 'Soft Launch',
  wordmark: ['soft', 'launch'] as const,
  tagline: 'Soft launch your crush.',
  campus: 'IIT Hyderabad',
  edition: "Prom '26",
} as const;

// All times are in IST (+05:30).
// Registration: 17–21 Sep
// Gap Day: 22 Sep
// Picking Phase: 23 Sep (24 hours only)
// Reveal: 24 Sep
export const PHASES = {
  signupOpen: new Date('2026-09-17T00:00:00+05:30'),
  signupClose: new Date('2026-09-22T00:00:00+05:30'),
  pickOpen: new Date('2026-09-23T00:00:00+05:30'),
  pickClose: new Date('2026-09-23T23:59:59+05:30'),
  reveal: new Date('2026-09-24T00:01:00+05:30'),
  prom: new Date('2026-09-26T00:00:00+05:30'),
  deleteData: new Date('2026-09-27T00:01:00+05:30'),
} as const;

export type Phase =
  | 'before'
  | 'signup'
  | 'gap'
  | 'picking'
  | 'waiting'
  | 'revealed'
  | 'closed';

export function currentPhase(now: Date = new Date()): Phase {
  if (process.env.NEXT_PUBLIC_PICK_ANYTIME === 'true') {
    return 'picking';
  }
  const t = now.getTime();
  if (t < PHASES.signupOpen.getTime()) return 'before';
  if (t <= PHASES.signupClose.getTime()) return 'signup';
  if (t < PHASES.pickOpen.getTime()) return 'gap';
  if (t <= PHASES.pickClose.getTime()) return 'picking';
  if (t < PHASES.reveal.getTime()) return 'waiting';
  if (t < PHASES.deleteData.getTime()) return 'revealed';
  return 'closed';
}

// Site-wide announcement banner.
export const PURPOSE =
  'For everyone a little too shy to ask — may a few more of us find our person before prom. 🌹';

// Open-source repository link for cryptography audits.
export const REPO_URL = 'https://github.com/iithsoftlaunch/softlaunch';

export const ALLOWED_EMAIL_DOMAIN = 'iith.ac.in';

export function isAllowedEmail(email: string): boolean {
  return email.trim().toLowerCase().endsWith('@' + ALLOWED_EMAIL_DOMAIN);
}

export function rollFromEmail(email: string): string {
  return email.trim().toLowerCase().split('@')[0];
}
