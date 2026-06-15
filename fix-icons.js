// fix-icons.js — replaces emoji nav icons with clean SVG line icons
const fs = require('fs');
const path = require('path');

const file = path.join(process.env.HOME, 'Buyer-Finder', 'index.html');
let html = fs.readFileSync(file, 'utf8');

// ── BOTTOM NAV replacements ──────────────────────────────────────
const navReplacements = [
  {
    find: /<div class="nav-item active" id="nav-home">\s*<span>🏠<\/span>\s*<span class="nav-label">Home<\/span>\s*<\/div>/,
    replace: `<div class="nav-item active" id="nav-home">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H5a1 1 0 01-1-1V9.5z"/><path d="M9 21V12h6v9"/></svg>
      <span class="nav-label">Home</span>
    </div>`
  },
  {
    find: /<div class="nav-item" id="nav-matches">\s*<span>✨<\/span>\s*<span class="nav-label">Matches<\/span>\s*<\/div>/,
    replace: `<div class="nav-item" id="nav-matches">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
      <span class="nav-label">Matches</span>
    </div>`
  },
  {
    find: /<div class="nav-item" id="nav-messages">\s*<span>💬<\/span>\s*<span class="nav-label">Messages<\/span>\s*<\/div>/,
    replace: `<div class="nav-item" id="nav-messages">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
      <span class="nav-label">Messages</span>
    </div>`
  },
  {
    find: /<div class="nav-item" id="nav-notifications">\s*<span>🔔<\/span>\s*<span class="nav-label">Alerts<\/span>\s*<\/div>/,
    replace: `<div class="nav-item" id="nav-notifications">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>
      <span class="nav-label">Alerts</span>
    </div>`
  },
  {
    find: /<div class="nav-item" id="nav-map">\s*<span>🗺<\/span>\s*<span class="nav-label">Map<\/span>\s*<\/div>/,
    replace: `<div class="nav-item" id="nav-map">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/></svg>
      <span class="nav-label">Map</span>
    </div>`
  },
];

let changed = 0;
for (const r of navReplacements) {
  if (r.find.test(html)) {
    html = html.replace(r.find, r.replace);
    changed++;
    console.log('✅ Replaced nav icon');
  } else {
    console.log('⚠️  Pattern not found, trying loose match...');
    // Try loose match
  }
}

fs.writeFileSync(file, html, 'utf8');
console.log(`Done. ${changed} nav icons replaced.`);
