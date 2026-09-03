const fs = require('fs'), path = require('path');
const pdfParse = require('pdf-parse');
const { extractTableSection, parseBranchRows } = require('./release-downloader');

const base = '/home/byron-realpe/Descargas/Version1.86.1.1';

function pdfs(dir) {
  const out = [];
  const walk = d => { for (const e of fs.readdirSync(d, {withFileTypes:true})) {
    const f = path.join(d, e.name);
    if (e.isDirectory()) walk(f); else if (/\.pdf$/i.test(e.name)) out.push(f);
  }};
  if (fs.existsSync(dir)) walk(dir);
  return out;
}

(async () => {
  let total = 0;
  for (const wi of fs.readdirSync(base).filter(f => /^\d+$/.test(f))) {
    const files = pdfs(path.join(base, wi));
    if (!files.length) { console.log(`\n### ${wi}: SIN PDF (sin adjunto en Azure)`); continue; }
    console.log(`\n### ${wi}`);
    for (const f of files) {
      const { text } = await pdfParse(fs.readFileSync(f));
      const rows = parseBranchRows(extractTableSection(text), wi, '');
      total += rows.length;
      if (!rows.length) console.log('   (0 ramas)');
      rows.forEach(r => console.log(`   Proyecto="${r.proyecto}"  |  Rama="${r.rama}"`));
    }
  }
  console.log(`\nTOTAL ramas: ${total}`);
})();
