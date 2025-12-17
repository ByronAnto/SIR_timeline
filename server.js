// server.js
require('dotenv').config();
const express = require('express');
const app = express();
const path = require('path');
const fs = require('fs');

// Middleware para parsear JSON
app.use(express.json());

// Servir archivos estáticos desde la carpeta 'public'
app.use(express.static(path.join(__dirname, 'public')));

// Endpoint para obtener los datos del archivo JSON
app.get('/data/document.json', (req, res) => {
  // Desactivar caché para siempre tener datos frescos
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  fs.readFile(path.join(__dirname, 'data', 'document.json'), 'utf8', (err, data) => {
    if (err) {
      res.status(500).send('Error reading data');
      return;
    }
    res.json(JSON.parse(data));
  });
});

// API endpoint para preview (solo buscar, no sincronizar)
app.post('/api/sync/preview', async (req, res) => {
  try {
    const { version } = req.body;

    if (!version) {
      return res.status(400).json({ error: 'Versión es requerida' });
    }

    // Importar módulo de sync
    const { AzureDevOpsClient, transformWorkItem } = require('./devops-sync.js');

    // Configuración
    const CONFIG = {
      organization: process.env.AZURE_DEVOPS_ORG || 'Grupo-KFC',
      project: process.env.AZURE_DEVOPS_PROJECT || 'SIR',
      token: process.env.AZURE_DEVOPS_TOKEN,
      apiVersion: '7.0'
    };

    // Normalizar versión
    let versionTag = version.trim();
    if (!versionTag.startsWith('V.')) {
      versionTag = `V.${versionTag}`;
    }
    const versionNumber = versionTag.replace('V.', '');

    // Conectar a Azure DevOps
    const client = new AzureDevOpsClient(CONFIG);

    // Buscar work items
    const workItems = await client.getWorkItemsByVersion(versionTag);

    if (workItems.length === 0) {
      return res.status(404).json({
        error: `No se encontraron work items con tag ${versionTag} en el proyecto ${CONFIG.project}`,
        searchedTag: versionTag,
        project: CONFIG.project
      });
    }

    // Calcular cuántos detalles se crearán
    let totalDetails = 0;
    workItems.forEach(wi => {
      const details = transformWorkItem(wi);
      totalDetails += details.length;
    });

    // Respuesta con preview
    res.json({
      success: true,
      version: versionNumber,
      workItemsCount: workItems.length,
      detailsCount: totalDetails,
      workItems: workItems.map(wi => ({
        id: wi.id,
        title: wi.fields['System.Title'],
        type: wi.fields['System.WorkItemType'],
        state: wi.fields['System.State'],
        tags: wi.fields['System.Tags']
      }))
    });

  } catch (error) {
    console.error('Error en preview:', error);
    res.status(500).json({
      error: error.message || 'Error al conectar con Azure DevOps',
      details: 'Verifica que el token de Azure DevOps esté configurado correctamente'
    });
  }
});

// API endpoint para sincronización
app.post('/api/sync', async (req, res) => {
  try {
    const { version, date, year } = req.body;

    if (!version || !date || !year) {
      return res.status(400).json({ error: 'Faltan parámetros requeridos: version, date, year' });
    }

    // Importar módulo de sync
    const { AzureDevOpsClient, transformToVersion } = require('./devops-sync.js');

    // Configuración
    const CONFIG = {
      organization: process.env.AZURE_DEVOPS_ORG || 'Grupo-KFC',
      project: process.env.AZURE_DEVOPS_PROJECT || 'SIR',
      token: process.env.AZURE_DEVOPS_TOKEN,
      apiVersion: '7.0'
    };

    // Normalizar versión
    let versionTag = version.trim();
    if (!versionTag.startsWith('V.')) {
      versionTag = `V.${versionTag}`;
    }
    const versionNumber = versionTag.replace('V.', '');

    // Conectar a Azure DevOps
    const client = new AzureDevOpsClient(CONFIG);

    // Buscar work items
    const workItems = await client.getWorkItemsByVersion(versionTag);

    // Si no se encuentran work items, eliminar la versión del timeline (si existe)
    if (workItems.length === 0) {
      const documentPath = path.join(__dirname, 'data', 'document.json');
      const documentContent = fs.readFileSync(documentPath, 'utf8');
      const document = JSON.parse(documentContent);
      const existingIdx = document.data.findIndex(v => v.version === versionNumber);
      if (existingIdx >= 0) {
        document.data.splice(existingIdx, 1);
        fs.writeFileSync(documentPath, JSON.stringify(document, null, 2), 'utf8');
        return res.json({
          success: true,
          message: `No se encontraron work items con tag ${versionTag}. Versión ${versionNumber} eliminada del timeline.`,
          version: versionNumber,
          removed: true
        });
      } else {
        return res.json({
          success: true,
          message: `No se encontraron work items con tag ${versionTag}. La versión ${versionNumber} no estaba presente en el timeline.`,
          version: versionNumber,
          removed: false
        });
      }
    }

    // Transformar a versión
    const newVersion = transformToVersion(workItems, versionNumber, date, year);

    // Leer document.json
    const documentPath = path.join(__dirname, 'data', 'document.json');
    const documentContent = fs.readFileSync(documentPath, 'utf8');
    const document = JSON.parse(documentContent);

    // Actualizar o agregar versión
    const existingIndex = document.data.findIndex(v => v.version === newVersion.version);
    if (existingIndex >= 0) {
      document.data[existingIndex] = newVersion;
    } else {
      document.data.push(newVersion);
    }

    // Guardar
    fs.writeFileSync(documentPath, JSON.stringify(document, null, 2), 'utf8');

    // Respuesta exitosa
    res.json({
      success: true,
      version: versionNumber,
      date: date,
      workItemsCount: workItems.length,
      detailsCount: newVersion.details.length,
      workItems: workItems.map(wi => ({
        id: wi.id,
        title: wi.fields['System.Title'],
        type: wi.fields['System.WorkItemType']
      }))
    });

  } catch (error) {
    console.error('Error en sync:', error);
    res.status(500).json({
      error: error.message || 'Error interno del servidor'
    });
  }
});

// Servir el archivo HTML principal
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Iniciar el servidor en el puerto 3000
app.listen(3000, () => {
  console.log('Server is running on http://localhost:3000');
});