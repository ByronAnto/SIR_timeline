// Script automatizado para sincronizar V.1.58.1.1
require('dotenv').config();
const { AzureDevOpsClient, transformToVersion } = require('./devops-sync.js');
const fs = require('fs').promises;
const path = require('path');

const CONFIG = {
    organization: process.env.AZURE_DEVOPS_ORG || 'Grupo-KFC',
    project: process.env.AZURE_DEVOPS_PROJECT || 'SIR',
    token: process.env.AZURE_DEVOPS_TOKEN,
    documentPath: path.join(__dirname, 'data', 'document.json')
};

async function syncVersion() {
    try {
        console.log('🚀 Sincronizando V.1.58.1.1...\n');

        // Datos de la versión
        const versionTag = 'V.1.58.1.1';
        const versionNumber = '1.58.1.1';
        const versionDate = '17/12/2024';
        const year = 2025;

        console.log(`📌 Versión: ${versionNumber}`);
        console.log(`📅 Fecha: ${versionDate}`);
        console.log(`📆 Año: ${year}\n`);

        // Conectar a Azure DevOps
        const client = new AzureDevOpsClient(CONFIG);

        // Buscar work items
        console.log('🔍 Buscando work items...');
        const workItems = await client.getWorkItemsByVersion(versionTag);

        if (workItems.length === 0) {
            console.log('⚠️  No hay work items para sincronizar');
            return;
        }

        // Mostrar resumen
        console.log(`\n📊 Work Items encontrados:\n`);
        workItems.forEach(wi => {
            const type = wi.fields['System.WorkItemType'];
            const typeIcon = type === 'Bug' ? '🐛' : '📋';
            console.log(`  ${typeIcon} #${wi.id} - ${wi.fields['System.Title']}`);
        });

        // Transformar
        console.log('\n⚙️  Transformando datos...');
        const newVersion = transformToVersion(workItems, versionNumber, versionDate, year);

        // Leer document.json
        console.log('📖 Leyendo document.json...');
        const documentContent = await fs.readFile(CONFIG.documentPath, 'utf8');
        const document = JSON.parse(documentContent);

        // Verificar si existe
        const existingIndex = document.data.findIndex(v => v.version === newVersion.version);

        if (existingIndex >= 0) {
            console.log(`⚠️  Versión ${newVersion.version} ya existe. Actualizando...`);
            document.data[existingIndex] = newVersion;
        } else {
            console.log(`✨ Agregando nueva versión ${newVersion.version}`);
            document.data.push(newVersion);
        }

        // Guardar
        console.log('💾 Guardando document.json...');
        await fs.writeFile(CONFIG.documentPath, JSON.stringify(document, null, 2), 'utf8');

        console.log('\n✅ ¡Sincronización completada!');
        console.log(`\n📈 Versión ${newVersion.version} con ${newVersion.details.length} detalles`);
        console.log(`🔄 Recarga http://localhost:3000 para ver los cambios\n`);

    } catch (error) {
        console.error(`\n❌ Error: ${error.message}\n`);
    }
}

syncVersion();
