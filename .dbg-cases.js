const { parseBranchRows, extractTableSection } = require('./release-downloader');

const cases = [
  ['columna con espacio',        '1. Detalle del proyecto\nProyecto Rama\nSirLegacy feature/140835_Algo\nSirBack feature/140835_Algo'],
  ['columnas pegadas + sin ID',  '1. Detalle del proyecto\nProyectoRama\nSir Mobile Backfeature/gastos-caja-chica-pda\nFlutter_apk_pdafeature/gastos-caja-chica-pda'],
  ['legacy: rama sin prefijo',   'Proyecto Rama\nSirBack\n140835_Algo\nSirLegacy 140835_Algo'],
  ['prefijo partido en 2 lineas','Proyecto Rama\nSirLegacy feature/\n140835_Algo'],
  ['parentesis en proyecto',     'Proyecto Rama\nSirFront(Vue2) feature/144711_guiasDespachoHarverts'],
  ['hotfix / release / guiones', 'Proyecto Rama\nSirBack hotfix/151822-fix.sql\nSirWeb release/1.86.1.1\nSirBackfix/algo-menor'],
  ['prosa con rama (no tabla)',  'introducida por el feature 147171_habilitarBotonCancelar, PR #1256'],
];

let fail = 0;
for (const [name, txt] of cases) {
  const rows = parseBranchRows(txt, 1, 't');
  console.log(`\n• ${name}`);
  if (!rows.length) console.log('    (0 filas)');
  rows.forEach(r => {
    const partida = r.rama.match(/^\d/) && /\/$/.test(r.proyecto);
    if (partida) fail++;
    console.log(`    Proyecto="${r.proyecto}"  Rama="${r.rama}"${partida ? '   ❌ RAMA PARTIDA' : ''}`);
  });
}
console.log(`\n${fail === 0 ? '✅ ninguna rama partida' : '❌ ' + fail + ' ramas partidas'}`);
