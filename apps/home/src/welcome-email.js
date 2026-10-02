// The email someone gets right after joining the waitlist (sent through Brevo, see addToBrevo in index.js).
// Inline styles and a table layout, because email clients ignore most of modern CSS.

const NAMES = { math: 'Math', nature: 'Nature', mechanics: 'Mechanics', pro: 'Pro' };

const OPEN = [
  ['Communication', 'vrtor.io/com', 'Practice a coffee chat, a job interview or a talk, with an AI coach between takes.'],
  ['Machu Picchu', 'vrtor.io/mpc', 'Walk the citadel and look closely at Inca stonework.'],
  ['Taj Mahal', 'vrtor.io/taj', 'Explore symmetry and Mughal architecture.'],
  ['Space', 'vrtor.io/spc', "Walk around NASA's Perseverance rover on Mars."],
];
const TOGETHER = 'In Space, Taj Mahal and Machu Picchu, choose Join others to see and talk with whoever else is exploring.';

export function welcomeEmail(subject) {
  const name = NAMES[subject];
  const promise = name
    ? `We'll send you one email when ${name} opens.`
    : "We'll send you one email each time a new subject opens.";
  const title = "You're on the VRtor waitlist";

  const rows = OPEN.map(
    ([label, link, about]) => `
          <tr><td style="padding:0 0 16px">
            <a href="https://${link}" style="font:700 17px/1.4 Arial,sans-serif;color:#3d5afe;text-decoration:none">${label}</a>
            <span style="font:400 14px/1.4 'Courier New',monospace;color:#5d6b80">&nbsp;${link}</span>
            <div style="font:400 15px/1.5 Arial,sans-serif;color:#0f1b2d">${about}</div>
          </td></tr>`,
  ).join('');

  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head>
<body style="margin:0;padding:0;background:#e9eef2">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#e9eef2">
    <tr><td align="center" style="padding:32px 16px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#f7f9fb;border:1px solid #cfd8e1;border-radius:12px">
        <tr><td style="padding:32px 28px 8px">
          <div style="font:700 22px/1 Arial,sans-serif;color:#0f1b2d">VRtor<span style="color:#5d6b80">.io</span></div>
        </td></tr>
        <tr><td style="padding:16px 28px 0">
          <h1 style="margin:0 0 12px;font:700 24px/1.3 Arial,sans-serif;color:#0f1b2d">${title}</h1>
          <p style="margin:0 0 24px;font:400 16px/1.6 Arial,sans-serif;color:#0f1b2d">Thanks for signing up. ${promise} Nothing else.</p>
          <p style="margin:0 0 16px;font:700 16px/1.6 Arial,sans-serif;color:#0f1b2d">Open now, free, no install:</p>
        </td></tr>
        <tr><td style="padding:0 28px">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}
          </table>
        </td></tr>
        <tr><td style="padding:8px 28px 32px">
          <p style="margin:0 0 12px;font:400 15px/1.6 Arial,sans-serif;color:#0f1b2d">${TOGETHER}</p>
          <p style="margin:0;font:400 15px/1.6 Arial,sans-serif;color:#5d6b80">In a headset, type the address into the browser and press Enter VR. On a phone or laptop it opens as a 3D page.</p>
        </td></tr>
      </table>
      <p style="margin:16px 0 0;font:400 13px/1.5 Arial,sans-serif;color:#5d6b80">You got this because you joined the waitlist at <a href="https://vrtor.io" style="color:#5d6b80">vrtor.io</a>.</p>
    </td></tr>
  </table>
</body></html>`;

  const text = [
    title,
    '',
    `Thanks for signing up. ${promise} Nothing else.`,
    '',
    'Open now, free, no install:',
    ...OPEN.map(([label, link, about]) => `- ${label} (https://${link}): ${about}`),
    '',
    TOGETHER,
    '',
    'In a headset, type the address into the browser and press Enter VR. On a phone or laptop it opens as a 3D page.',
    '',
    'You got this because you joined the waitlist at vrtor.io.',
  ].join('\n');

  return { subject: title, html, text };
}
