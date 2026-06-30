// portraits.js — parametric SVG character portraits with expression states.
// Zero-dependency, crisp at any size. One shared template differentiated by
// palette + ear/face/feature params, so the whole roster shares an art language.
//
// portraitSVG(id, expr) → an <svg> string. expr ∈
//   neutral | smug | rattled | angry | gloating
// Reused at three sizes (seat avatar, face-off, chip) via CSS sizing.

export const PORTRAITS = {
  vera:  { fur: '#f08a4b', fur2: '#c95f24', light: '#ffe2c4', eye: '#3a2410', ears: 'pointed', face: 'muzzle' },
  mac:   { fur: '#7a5a44', fur2: '#523a2b', light: '#cdb39c', eye: '#241810', ears: 'round',   face: 'muzzle' },
  pip:   { fur: '#b9a06a', fur2: '#8a7340', light: '#efe3c2', eye: '#2a2008', ears: 'tuft',    face: 'beak' },
  duke:  { fur: '#6b6f78', fur2: '#444851', light: '#c3c7cf', eye: '#1a1c22', ears: 'round',   face: 'muzzle', feature: 'tusks' },
  coral: { fur: '#56b9d6', fur2: '#2f87a6', light: '#d2f0fa', eye: '#10303a', ears: 'fin',     face: 'snout' },
  rex:   { fur: '#e8b24a', fur2: '#b8801f', light: '#ffe9b0', eye: '#3a2700', ears: 'round',   face: 'muzzle', feature: 'mane' },
  nyx:   { fur: '#2b2b33', fur2: '#15151b', light: '#4a4a55', eye: '#7CFF9B', ears: 'pointed', face: 'muzzle' },
  sage:  { fur: '#5fa55f', fur2: '#3c763c', light: '#cfe8c2', eye: '#1d3a14', ears: 'none',    face: 'beak' },
  bo:    { fur: '#d79a52', fur2: '#a86f2e', light: '#f4ddb8', eye: '#2a1c0c', ears: 'floppy',  face: 'muzzle' },
  kit:   { fur: '#f4d24a', fur2: '#d6ab1f', light: '#fff2bf', eye: '#3a2c00', ears: 'none',    face: 'beak' },
  // marquee villain (slice content): a raven card-sharp
  vesper:{ fur: '#23252e', fur2: '#0e0f15', light: '#3a3d49', eye: '#c8a24a', ears: 'tuft',    face: 'beak', feature: 'sheen' },
};

let uid = 0;

export function portraitSVG(id, expr = 'neutral') {
  const p = PORTRAITS[id];
  if (!p) return '';
  const g = `pg${uid++}`;
  return `<svg viewBox="0 0 100 100" class="portrait portrait-${expr}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <defs>
    <radialGradient id="${g}" cx="42%" cy="36%" r="72%">
      <stop offset="0%" stop-color="${p.fur}"/>
      <stop offset="100%" stop-color="${p.fur2}"/>
    </radialGradient>
  </defs>
  ${p.feature === 'mane' ? `<circle cx="50" cy="56" r="40" fill="${p.fur2}"/>` : ''}
  ${ears(p)}
  <ellipse cx="50" cy="55" rx="34" ry="33" fill="url(#${g})" stroke="rgba(0,0,0,.25)" stroke-width="1"/>
  <ellipse cx="42" cy="40" rx="20" ry="14" fill="rgba(255,255,255,.10)"/>
  ${p.feature === 'sheen' ? `<ellipse cx="40" cy="33" rx="15" ry="8" fill="rgba(150,185,255,.20)"/><ellipse cx="62" cy="46" rx="6" ry="14" fill="rgba(120,160,255,.12)"/>` : ''}
  ${faceFeature(p)}
  ${brows(expr)}
  ${eyes(expr, p.eye)}
  ${mouth(expr, p)}
</svg>`;
}

function ears(p) {
  const { fur, fur2 } = p;
  switch (p.ears) {
    case 'pointed':
      return `<polygon points="24,30 18,2 44,22" fill="${fur2}"/><polygon points="76,30 82,2 56,22" fill="${fur2}"/>
              <polygon points="27,27 24,11 39,22" fill="${fur}"/><polygon points="73,27 76,11 61,22" fill="${fur}"/>`;
    case 'round':
      return `<circle cx="24" cy="26" r="12" fill="${fur2}"/><circle cx="76" cy="26" r="12" fill="${fur2}"/>
              <circle cx="24" cy="26" r="6" fill="${fur}"/><circle cx="76" cy="26" r="6" fill="${fur}"/>`;
    case 'floppy':
      return `<ellipse cx="20" cy="46" rx="9" ry="20" fill="${fur2}"/><ellipse cx="80" cy="46" rx="9" ry="20" fill="${fur2}"/>`;
    case 'tuft':
      return `<polygon points="28,24 22,6 40,20" fill="${fur2}"/><polygon points="72,24 78,6 60,20" fill="${fur2}"/>`;
    case 'fin':
      return `<polygon points="50,6 40,26 60,26" fill="${fur2}"/>`;
    default:
      return '';
  }
}

function faceFeature(p) {
  if (p.face === 'beak') {
    const beak = '#e8a13a';
    return `<polygon points="50,56 40,62 50,72 60,62" fill="${beak}"/>
            <polygon points="50,56 44,62 50,67 56,62" fill="rgba(0,0,0,.18)"/>`;
  }
  if (p.face === 'snout') {
    return `<ellipse cx="50" cy="66" rx="20" ry="13" fill="${p.light}"/>
            <ellipse cx="50" cy="62" rx="5" ry="3.5" fill="rgba(0,0,0,.55)"/>`;
  }
  // muzzle
  let extra = '';
  if (p.feature === 'tusks') {
    extra = `<polygon points="42,70 39,80 45,72" fill="#f3ece0"/><polygon points="58,70 61,80 55,72" fill="#f3ece0"/>`;
  }
  return `<ellipse cx="50" cy="66" rx="17" ry="13" fill="${p.light}"/>
          <ellipse cx="50" cy="60" rx="4.5" ry="3.2" fill="rgba(0,0,0,.6)"/>${extra}`;
}

function eyes(expr, color) {
  const L = 38, R = 62, y = 49;
  if (expr === 'gloating') {
    // happy closed arcs
    return `<path d="M${L - 6} ${y} Q${L} ${y - 7} ${L + 6} ${y}" stroke="#1a1a1a" stroke-width="2.4" fill="none" stroke-linecap="round"/>
            <path d="M${R - 6} ${y} Q${R} ${y - 7} ${R + 6} ${y}" stroke="#1a1a1a" stroke-width="2.4" fill="none" stroke-linecap="round"/>`;
  }
  let ry = 7, iris = 3.4, iy = y;
  if (expr === 'smug') { ry = 4.2; iy = y - 1.4; }
  else if (expr === 'angry') { ry = 5; iris = 3; }
  else if (expr === 'rattled') { ry = 9; iris = 2.6; }
  const eye = (cx) =>
    `<ellipse cx="${cx}" cy="${y}" rx="7" ry="${ry}" fill="#fbfbfd"/>` +
    `<circle cx="${cx}" cy="${iy}" r="${iris}" fill="${color}"/>` +
    `<circle cx="${cx + 1}" cy="${iy - 1}" r="1" fill="rgba(255,255,255,.9)"/>`;
  return eye(L) + eye(R);
}

function brows(expr) {
  const c = '#0e0e12', w = 3;
  const seg = (x1, y1, x2, y2) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${c}" stroke-width="${w}" stroke-linecap="round"/>`;
  switch (expr) {
    case 'angry':   return seg(32, 36, 44, 41) + seg(68, 36, 56, 41);   // inner-down V
    case 'smug':    return seg(31, 35, 45, 34) + seg(55, 39, 69, 38);   // one raised
    case 'rattled': return seg(32, 39, 44, 35) + seg(68, 39, 56, 35);   // worried, inner-up
    case 'gloating':return seg(32, 35, 44, 36) + seg(56, 36, 68, 35);
    default:        return seg(32, 38, 44, 38) + seg(56, 38, 68, 38);   // neutral
  }
}

function mouth(expr, p) {
  if (p.face === 'beak') return ''; // beak conveys the expression
  const c = '#1a1a1a', y = 78;
  switch (expr) {
    case 'smug':    return `<path d="M44 ${y} Q54 ${y + 5} 60 ${y - 3}" stroke="${c}" stroke-width="2.2" fill="none" stroke-linecap="round"/>`;
    case 'angry':   return `<path d="M42 ${y + 3} Q50 ${y - 4} 58 ${y + 3}" stroke="${c}" stroke-width="2.4" fill="none" stroke-linecap="round"/>`;
    case 'rattled': return `<ellipse cx="50" cy="${y + 1}" rx="4" ry="5" fill="${c}"/>`;
    case 'gloating':return `<path d="M40 ${y - 2} Q50 ${y + 9} 60 ${y - 2} Z" fill="${c}"/><path d="M43 ${y} Q50 ${y + 3} 57 ${y}" stroke="#fff" stroke-width="2" fill="none"/>`;
    default:        return `<path d="M44 ${y} Q50 ${y + 3} 56 ${y}" stroke="${c}" stroke-width="2.2" fill="none" stroke-linecap="round"/>`;
  }
}
