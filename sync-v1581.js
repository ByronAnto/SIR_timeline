// Script para sincronizar V.1.58.1.1 con TODOS los work items
require('dotenv').config();
const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');

const CONFIG = {
    organization: process.env.AZURE_DEVOPS_ORG || 'Grupo-KFC',
    project: process.env.AZURE_DEVOPS_PROJECT || 'SIR',
    token: process.env.AZURE_DEVOPS_TOKEN,
    documentPath: path.join(__dirname, 'data', 'document.json')
};

const COUNTRY_MAP = {
    'CO': 'Colombia', 'ECU': 'Ecuador', 'EC': 'Ecuador',
    'BR': 'Brasil', 'ES': 'España', 'ESP': 'España',
    'VE': 'Venezuela', 'VEN': 'Venezuela',
    'CHI': 'Chile', 'CH': 'Chile',
    'AR': 'Argentina', 'RE': 'Regional'
};

const TYPE_MAP = {
    'Bug': 'Defecto',
    'Defect': 'Defecto',
    'User Story': 'Requerimiento',
    'Feature': 'Requerimiento',
    'Task': 'Requerimiento'
};

async function syncVersion() {
    try {
        console.log('🚀 Sincronizando V.1.58.1.1 con Azure DevOps...\n');

        const baseUrl = `https://dev.azure.com/${CONFIG.organization}/${CONFIG.project}/_apis`;
        const client = axios.create({
            baseURL: baseUrl,
            headers: {
                'Authorization': `Basic ${Buffer.from(`:${CONFIG.token}`).toString('base64')}`,
                'Content-Type': 'application/json'
            },
            params: { 'api-version': '7.0' }
        });

        // 1. Buscar TODOS los work items con tag V.1.58.1.1
        console.log('🔍 Buscando work items con tag V.1.58.1.1...');

        const wiql = {
            query: `SELECT [System.Id] FROM WorkItems WHERE [System.Tags] CONTAINS 'V.1.58.1.1' AND [System.TeamProject] = '${CONFIG.project}' ORDER BY [System.Id] DESC`
        };

        const wiqlResponse = await client.post('/wit/wiql', wiql);
        const workItemIds = wiqlResponse.data.workItems.map(wi => wi.id);

        console.log(`✅ Encontrados ${workItemIds.length} work items: ${workItemIds.join(', ')}\n`);

        if (workItemIds.length === 0) {
            console.log('⚠️  No hay work items con ese tag');
            return;
        }

        // 2. Obtener detalles de TODOS
        console.log('📥 Obteniendo detalles...');
        const idsParam = workItemIds.join(',');
        const wiResponse = await client.get('/wit/workitems', {
            params: { ids: idsParam }
        });

        const workItems = wiResponse.data.value;
        console.log(`✅ Detalles obtenidos\n`);

        // 3. Transformar cada work item
        const allDetails = [];

        workItems.forEach(workItem => {
            const fields = workItem.fields;
            const tags = fields['System.Tags'] || '';
            const tagArray = tags.split(';').map(t => t.trim());

            console.log(`📊 #${workItem.id} - ${fields['System.Title']}`);
            console.log(`   Type: ${fields['System.WorkItemType']}`);
            console.log(`   Tags: ${tags}\n`);

            // Extraer países
            const countries = tagArray
                .map(tag => COUNTRY_MAP[tag.toUpperCase()])
                .filter(Boolean);

            if (countries.length === 0) countries.push('No definido');

            // Determinar tipo
            const type = TYPE_MAP[fields['System.WorkItemType']] || 'Requerimiento';
            const sprint = (fields['System.IterationPath'] || '').split('\\').find(p => p.toLowerCase().includes('sprint')) || 'Sin sprint';

            // Crear detalles (uno por país)
            countries.forEach(country => {
                allDetails.push({
                    id: workItem.id.toString(),
                    type: type,
                    branch: workItem.id.toString(),
                    description: fields['System.Title'] || '',
                    observation: country,
                    proyect: 'Sir Legacy',
                    qaRegional: fields['System.State'] === 'Done' || fields['System.State'] === 'Resolved' ? 'Completado' : '',
                    sprint: sprint
                });
            });
        });

        const newVersion = {
            version: '1.58.1.1',
            date: '17/12/2025',
            year: 2025,
            sprint: allDetails[0]?.sprint || 'Sin sprint',
            description: '',
            details: allDetails
        };

        console.log(`📋 Versión con ${allDetails.length} detalles creada\n`);

        // 4. Actualizar document.json
        console.log('💾 Actualizando document.json...');
        const documentContent = await fs.readFile(CONFIG.documentPath, 'utf8');
        const document = JSON.parse(documentContent);

        const existingIndex = document.data.findIndex(v => v.version === '1.58.1.1');
        if (existingIndex >= 0) {
            console.log('⚠️  Versión ya existe. Reemplazando con nuevos datos...');
            document.data[existingIndex] = newVersion;
        } else {
            console.log('✨ Agregando nueva versión');
            document.data.push(newVersion);
        }

        await fs.writeFile(CONFIG.documentPath, JSON.stringify(document, null, 2), 'utf8');

        console.log('✅ ¡Sincronización completada!');
        console.log(`📈 Versión 1.58.1.1 con ${allDetails.length} detalles`);
        console.log(`🔄 Recarga http://localhost:3000\n`);

    } catch (error) {
        console.error('\n❌ Error:', error.response?.data || error.message);
    }
}

syncVersion();
