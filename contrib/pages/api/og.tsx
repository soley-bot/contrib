import type { NextApiRequest, NextApiResponse } from 'next';

/**
 * Static OG image endpoint — returns an SVG that social platforms render as the preview.
 * Referenced in _document.tsx as /og-image.png but we also serve this at /api/og.
 */
export default function handler(_req: NextApiRequest, res: NextApiResponse) {
  const svg = `<svg width="1200" height="630" viewBox="0 0 1200 630" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="1200" height="630" fill="#F8FAFF"/>

  <!-- Subtle grid -->
  <line x1="0" y1="157" x2="1200" y2="157" stroke="#E2E8F0" stroke-width="0.5" opacity="0.5"/>
  <line x1="0" y1="315" x2="1200" y2="315" stroke="#E2E8F0" stroke-width="0.5" opacity="0.5"/>
  <line x1="0" y1="473" x2="1200" y2="473" stroke="#E2E8F0" stroke-width="0.5" opacity="0.5"/>

  <!-- Logo mark -->
  <g transform="translate(520, 160) scale(1.5)">
    <line x1="58" y1="18" x2="58" y2="142" stroke="#1A56E8" stroke-width="3" opacity="0.15" stroke-linecap="round"/>
    <circle cx="58" cy="130" r="6" fill="#1A56E8" opacity="0.15"/>
    <circle cx="58" cy="108" r="6" fill="#1A56E8" opacity="0.15"/>
    <circle cx="58" cy="86" r="7" fill="#1A56E8" opacity="0.2"/>
    <circle cx="58" cy="46" r="12" fill="#1A56E8"/>
    <line x1="70" y1="46" x2="118" y2="46" stroke="#1A56E8" stroke-width="3" stroke-linecap="round"/>
    <circle cx="122" cy="46" r="5" fill="#1A56E8"/>
  </g>

  <!-- Title -->
  <text x="600" y="430" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-size="64" font-weight="800" fill="#0F172A">Contrib</text>

  <!-- Tagline -->
  <text x="600" y="480" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-size="24" font-weight="500" fill="#64748B">Make group contributions visible</text>

  <!-- URL -->
  <text x="600" y="570" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-size="18" font-weight="600" fill="#1A56E8">joincontrib.com</text>
</svg>`;

  res.setHeader('Content-Type', 'image/svg+xml');
  res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=86400');
  res.status(200).send(svg);
}
