// release-downloader.js
// Descarga adjuntos de HUs de Azure DevOps, extrae zip/rar,
// parsea PDFs de paso a producción y genera Excel.

require('dotenv').config();
const axios    = require('axios');
const fs       = require('fs');
const path     = require('path');
const os       = require('os');
const { execSync } = require('child_process');
const unzipper      = require('unzipper');
const { createExtractorFromFile } = require('node-unrar-js');
const pdfParse = require('pdf-parse');
const ExcelJS  = require('exceljs');

// ─── Configuración ────────────────────────────────────────────────────────────

function getConfig() {
  return {
    token  : process.env.AZURE_DEVOPS_TOKEN,
    org    : process.env.AZURE_DEVOPS_ORG     || 'Grupo-KFC',
    project: process.env.AZURE_DEVOPS_PROJECT || 'SIR'
  };
}

/**
 * Devuelve la carpeta de descargas del SO.
 * En Linux busca ~/Descargas (español) y luego ~/Downloads.
 * Se puede sobreescribir con DOWNLOADS_PATH en .env.
 */
function getDownloadsPath() {
  if (process.env.DOWNLOADS_PATH) return process.env.DOWNLOADS_PATH;
  const home = os.homedir();
  if (os.platform() === 'linux') {
    const descargas = path.join(home, 'Descargas');
    if (fs.existsSync(descargas)) return descargas;
  }
  return path.join(home, 'Downloads');
}

// ─── Azure DevOps — adjuntos ──────────────────────────────────────────────────

function buildClient(token) {
  return axios.create({
    headers: {
      Authorization: `Basic ${Buffer.from(`:${token}`).toString('base64')}`
    },
    maxRedirects: 5
  });
}

async function getWorkItemAttachments(wiId, cfg) {
  const client = buildClient(cfg.token);
  const url = `https://dev.azure.com/${cfg.org}/${cfg.project}/_apis/wit/workItems/${wiId}?$expand=all&api-version=7.1`;
  const { data } = await client.get(url);
  return (data.relations || [])
    .filter(r => r.rel === 'AttachedFile')
    .map(r => ({ name: r.attributes?.name || 'attachment', url: r.url }));
}

async function downloadFile(fileUrl, destPath, cfg) {
  const client = buildClient(cfg.token);
  const { data } = await client.get(`${fileUrl}?api-version=7.1`, {
    responseType: 'arraybuffer'
  });
  fs.writeFileSync(destPath, data);
}

// ─── Extracción de archivos ───────────────────────────────────────────────────

async function extractZip(archivePath, destDir) {
  await fs.createReadStream(archivePath)
    .pipe(unzipper.Extract({ path: destDir }))
    .promise();
}

async function extractRar(archivePath, destDir) {
  const extractor = await createExtractorFromFile({ filepath: archivePath, targetPath: destDir });
  const { files } = extractor.extract();
  // Consume the generator to actually extract all files
  for (const file of files) { /* extracted */ }
}

function findFilesRecursive(dir, ext) {
  const results = [];
  if (!fs.existsSync(dir)) return results;
  const walk = (d) => {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (!ext || entry.name.toLowerCase().endsWith(ext)) {
        results.push(full);
      }
    }
  };
  walk(dir);
  return results;
}

// ─── Parseo de PDFs ───────────────────────────────────────────────────────────

// Patrón de rama: 6 dígitos + _ + nombre (ej: 117406_CuponesMejorasReportePorCadena)
const BRANCH_RE      = /^\d{3,6}_\w+$/;
const BRANCH_INLINE  = /(\d{3,6}_\w+)/;
// Líneas que son cabeceras o decoración de tabla
const HEADER_RE      = /^(Proyecto(\s+Rama)?|Rama|Detalle del proyecto|1\.\s*Detalle)$/i;

/**
 * Encuentra el índice de la ÚLTIMA ocurrencia de un patrón en el texto.
 * Retorna -1 si no se encuentra.
 */
function lastIndexOfPattern(text, pattern) {
  let pos = -1;
  let search = 0;
  while (true) {
    const match = text.slice(search).search(pattern);
    if (match === -1) break;
    pos = search + match;
    search = pos + 1;
  }
  return pos;
}

/**
 * Extrae el section relevante del PDF para el parseo de la tabla.
 * Estrategia:
 *  1. Busca la ÚLTIMA "Detalle del proyecto" (contenido real, no TOC)
 *  2. Si no da resultados, busca la ÚLTIMA "Proyecto Rama" directamente
 */
function extractTableSection(text) {
  // Intento 1: última ocurrencia de "Detalle del proyecto"
  const detIdx = lastIndexOfPattern(text, /Detalle del proyecto/i);
  if (detIdx !== -1) {
    const endSearch = text.slice(detIdx).search(
      /Configuraci[oó]n en el archivo|\.Env\b|Scripts\b|CONFIGURACI|PROCEDIMIENTO|OBJETIVO/i
    );
    const section = endSearch > 0
      ? text.slice(detIdx, detIdx + endSearch)
      : text.slice(detIdx, detIdx + 800);
    if (section.search(/Proyecto\s+Rama/i) !== -1) return section;
  }

  // Intento 2: última ocurrencia de "Proyecto Rama" (ej: 115139 sin encabezado)
  const prIdx = lastIndexOfPattern(text, /Proyecto\s+Rama/i);
  if (prIdx !== -1) {
    const endSearch = text.slice(prIdx).search(
      /Configuraci[oó]n|\.Env\b|Scripts\b|CONFIGURACI|PROCEDIMIENTO|OBJETIVO/i
    );
    return endSearch > 0
      ? text.slice(prIdx, prIdx + endSearch)
      : text.slice(prIdx, prIdx + 800);
  }

  return '';
}

async function extractBranchesFromPDF(pdfPath, wiId, wiTitle) {
  try {
    const buffer = fs.readFileSync(pdfPath);
    const { text } = await pdfParse(buffer);

    const section = extractTableSection(text);
    if (!section) return [];

    const lines = section.split('\n').map(l => l.trim()).filter(Boolean);
    const results = [];
    let pendingProject = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Saltar cabeceras de tabla
      if (HEADER_RE.test(line)) continue;

      // Caso 1: la línea entera es una rama → emparejar con proyecto pendiente
      if (BRANCH_RE.test(line)) {
        if (pendingProject) {
          results.push({ wiId, wiTitle, proyecto: pendingProject, rama: line });
          pendingProject = null;
        }
        continue;
      }

      // Caso 2: la línea contiene proyecto + rama en la misma línea
      const inlineMatch = line.match(BRANCH_INLINE);
      if (inlineMatch) {
        const proyecto = line.slice(0, inlineMatch.index).trim();
        const rama = inlineMatch[1];
        if (proyecto) {
          results.push({ wiId, wiTitle, proyecto, rama });
        } else if (pendingProject) {
          results.push({ wiId, wiTitle, proyecto: pendingProject, rama });
          pendingProject = null;
        }
        continue;
      }

      // Caso 3: línea sin rama → es un nombre de proyecto, guardarlo
      pendingProject = line;
    }

    return results;
  } catch (e) {
    console.error(`  ⚠️  No se pudo parsear PDF ${path.basename(pdfPath)}: ${e.message}`);
    return [];
  }
}

// ─── Generación de Excel ──────────────────────────────────────────────────────

const RED_KFC   = 'A50C0E';
const DARK_GRAY = '404040';
const WHITE     = 'FFFFFF';
const DARK      = '1A1A1A';
const HU_COLORS = [
  'FFF2CC', 'DDEEFF', 'E2EFDA', 'FCE4EC', 'EDE7F6',
  'FFF9C4', 'E8F5E9', 'E3F2FD', 'FBE9E7', 'F3E5F5'
];

const COUNTRY_MAP = {
  CO: 'Colombia', ECU: 'Ecuador', EC: 'Ecuador',
  BR: 'Brasil',   ES: 'España',   ESP: 'España',
  VE: 'Venezuela', VEN: 'Venezuela',
  CHI: 'Chile',   CH: 'Chile',
  AR: 'Argentina', RE: 'Regional'
};

function applyBorder(cell) {
  const side = { style: 'thin', color: { argb: 'CCCCCC' } };
  cell.border = { top: side, bottom: side, left: side, right: side };
}

function styleHeader(cell, bgArgb = RED_KFC) {
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgArgb } };
  cell.font = { name: 'Calibri', bold: true, color: { argb: WHITE }, size: 11 };
  cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  applyBorder(cell);
}

function styleData(cell, bgArgb = 'FFFFFF', bold = false, align = 'center') {
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgArgb } };
  cell.font = { name: 'Calibri', bold, color: { argb: DARK }, size: 10 };
  cell.alignment = { horizontal: align, vertical: 'middle', wrapText: true };
  applyBorder(cell);
}

async function generateExcel(version, workItems, allBranches, outputPath) {
  const wb = new ExcelJS.Workbook();

  // ── Mapa de colores por HU ──────────────────────────────────────────────────
  const huIds = [...new Set(workItems.map(wi => wi.id))];
  const huColorMap = {};
  huIds.forEach((id, idx) => { huColorMap[id] = HU_COLORS[idx % HU_COLORS.length]; });

  // ── Mapa de país por HU (desde tags) ───────────────────────────────────────
  const wiCountryMap = {};
  workItems.forEach(wi => {
    if (wi.tags) {
      const parts = wi.tags.split(';').map(t => t.trim().toUpperCase());
      const country = parts.map(p => COUNTRY_MAP[p]).find(Boolean) || 'No definido';
      wiCountryMap[wi.id] = country;
    } else {
      wiCountryMap[wi.id] = 'No definido';
    }
  });

  // ── Mapa de ramas por WI ───────────────────────────────────────────────────
  const branchesByWI = {};
  allBranches.forEach(b => {
    if (!branchesByWI[b.wiId]) branchesByWI[b.wiId] = [];
    branchesByWI[b.wiId].push(b);
  });

  // ════════════════════════════════════════════════════════════════════════════
  // HOJA 1 — Ramas a Producción
  // ════════════════════════════════════════════════════════════════════════════
  const ws1 = wb.addWorksheet('Ramas a Producción');

  // Título
  ws1.mergeCells('A1:F1');
  const t1 = ws1.getCell('A1');
  t1.value = `VERSIÓN SIR ${version} — Ramas a Producción`;
  styleHeader(t1, RED_KFC);
  t1.font = { name: 'Calibri', bold: true, color: { argb: WHITE }, size: 14 };
  ws1.getRow(1).height = 30;

  // Sub-título
  ws1.mergeCells('A2:F2');
  const sub1 = ws1.getCell('A2');
  sub1.value = `Fecha de descarga: ${new Date().toLocaleDateString('es-EC')}  |  Proyecto: SIR  |  Azure DevOps: Grupo-KFC`;
  styleHeader(sub1, DARK_GRAY);
  sub1.font = { name: 'Calibri', bold: false, color: { argb: WHITE }, size: 10 };
  ws1.getRow(2).height = 16;

  // Cabeceras
  ['# HU', 'Descripción', 'País', 'Proyecto de Codificación', 'Rama', 'Estado'].forEach((h, i) => {
    const cell = ws1.getRow(3).getCell(i + 1);
    cell.value = h;
    styleHeader(cell, RED_KFC);
  });
  ws1.getRow(3).height = 20;

  // Filas de datos
  let rowNum = 4;
  for (const wi of workItems) {
    const branches = branchesByWI[wi.id] || [];
    const bg      = huColorMap[wi.id];
    const country = wiCountryMap[wi.id];
    const estado  = wi.state || 'UAT';

    const dataRows = branches.length > 0
      ? branches.map(b => [wi.id, wi.title, country, b.proyecto, b.rama, estado])
      : [[wi.id, wi.title, country, '(ver PDF)', '(ver PDF)', estado]];

    for (const cols of dataRows) {
      const row = ws1.getRow(rowNum);
      row.height = 22;
      cols.forEach((v, i) => {
        const cell = row.getCell(i + 1);
        cell.value = v;
        styleData(cell, bg, i === 0, i === 1 ? 'left' : 'center');
      });
      rowNum++;
    }
  }

  // Anchos y freeze
  [10, 44, 14, 24, 50, 10].forEach((w, i) => { ws1.getColumn(i + 1).width = w; });
  ws1.views = [{ state: 'frozen', xSplit: 0, ySplit: 3 }];

  // ════════════════════════════════════════════════════════════════════════════
  // HOJA 2 — Resumen por HU
  // ════════════════════════════════════════════════════════════════════════════
  const ws2 = wb.addWorksheet('Resumen por HU');

  ws2.mergeCells('A1:E1');
  const t2 = ws2.getCell('A1');
  t2.value = `RESUMEN POR HU — Versión SIR ${version}`;
  styleHeader(t2, RED_KFC);
  t2.font = { name: 'Calibri', bold: true, color: { argb: WHITE }, size: 13 };
  ws2.getRow(1).height = 26;

  ['# HU', 'Descripción', 'País', '# Proyectos', 'Proyectos afectados'].forEach((h, i) => {
    const cell = ws2.getRow(2).getCell(i + 1);
    cell.value = h;
    styleHeader(cell, DARK_GRAY);
  });
  ws2.getRow(2).height = 20;

  let r2 = 3;
  for (const wi of workItems) {
    const branches  = branchesByWI[wi.id] || [];
    const proyectos = [...new Set(branches.map(b => b.proyecto))];
    const bg        = huColorMap[wi.id];

    const row = ws2.getRow(r2);
    row.height = 28;
    [wi.id, wi.title, wiCountryMap[wi.id], proyectos.length || '-', proyectos.join(', ') || '(ver PDF)']
      .forEach((v, i) => {
        const cell = row.getCell(i + 1);
        cell.value = v;
        styleData(cell, bg, i === 0, (i === 1 || i === 4) ? 'left' : 'center');
      });
    r2++;
  }

  [10, 46, 12, 13, 55].forEach((w, i) => { ws2.getColumn(i + 1).width = w; });
  ws2.views = [{ state: 'frozen', xSplit: 0, ySplit: 2 }];

  await wb.xlsx.writeFile(outputPath);
}

// ─── Función principal exportada ──────────────────────────────────────────────

/**
 * Descarga todos los adjuntos de los work items, extrae archivos,
 * parsea PDFs y genera el Excel de ramas a producción.
 *
 * @param {string}  version    - Número de versión, ej: "1.65.1.1"
 * @param {Array}   workItems  - [{id, title, type, state?, tags?}, ...]
 * @returns {Object} { versionFolder, excelName, excelPath, branches, branchesCount }
 */
async function downloadRelease(version, workItems) {
  const cfg          = getConfig();
  const basePath     = getDownloadsPath();
  const versionFolder = path.join(basePath, `Version${version}`);

  fs.mkdirSync(versionFolder, { recursive: true });
  console.log(`\n📁 Carpeta destino: ${versionFolder}`);

  const allBranches = [];

  for (const wi of workItems) {
    console.log(`\n📥 WI ${wi.id} — ${wi.title}`);
    try {
      const attachments = await getWorkItemAttachments(wi.id, cfg);
      const archives    = attachments.filter(a => /\.(zip|rar)$/i.test(a.name));
      const directPDFs  = attachments.filter(a => /\.pdf$/i.test(a.name));

      const wiFolder = path.join(versionFolder, String(wi.id));
      fs.mkdirSync(wiFolder, { recursive: true });

      let pdfPaths = [];

      if (archives.length > 0) {
        for (const archive of archives) {
          const tmpPath = path.join(versionFolder, archive.name);
          await downloadFile(archive.url, tmpPath, cfg);
          console.log(`  ⬇️  Descargado: ${archive.name}`);

          if (/\.zip$/i.test(archive.name)) {
            await extractZip(tmpPath, wiFolder);
          } else if (/\.rar$/i.test(archive.name)) {
            await extractRar(tmpPath, wiFolder);
          }

          fs.unlinkSync(tmpPath);
          console.log(`  📦 Extraído (comprimido eliminado)`);
        }
        pdfPaths = findFilesRecursive(wiFolder, '.pdf');
      } else if (directPDFs.length > 0) {
        const pdfPath = path.join(wiFolder, directPDFs[0].name);
        await downloadFile(directPDFs[0].url, pdfPath, cfg);
        pdfPaths = [pdfPath];
        console.log(`  ⬇️  PDF directo: ${directPDFs[0].name}`);
      } else {
        console.log(`  ℹ️  Sin adjuntos zip/rar/pdf`);
      }

      for (const pdfPath of pdfPaths) {
        const branches = await extractBranchesFromPDF(pdfPath, wi.id, wi.title);
        console.log(`  📄 ${path.basename(pdfPath)}: ${branches.length} ramas`);
        allBranches.push(...branches);
      }

    } catch (e) {
      console.error(`  ❌ Error WI ${wi.id}: ${e.message}`);
    }
  }

  // Generar Excel
  const excelName = `SIR_v${version}_Ramas_Produccion.xlsx`;
  const excelPath = path.join(versionFolder, excelName);
  await generateExcel(version, workItems, allBranches, excelPath);
  console.log(`\n✅ Excel generado: ${excelPath}`);

  return { versionFolder, excelName, excelPath, branches: allBranches, branchesCount: allBranches.length };
}

module.exports = { downloadRelease, getDownloadsPath };
