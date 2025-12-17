// Ejecución directa sin usar módulo
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

async function syncNow() {
    try {
        console.log('🚀 Sincronizando V.1.58.1.1 directamente...\n');

        const baseUrl = `https://dev.azure.com/${CONFIG.organization}/${CONFIG.project}/_apis`;
        const client = axios.create({
            baseURL: baseUrl,
            headers: {
                'Authorization': `Basic ${Buffer.from(`:${CONFIG.token}`).toString('base64')}`,
                'Content-Type': 'application/json'
            },
            params: { 'api-version': '7.0' }
        });

        // 1. Buscar work items
        console.log('🔍 Buscando work item 106883...');
        const wiResponse = await client.get('/wit/workitems/106883');
        const workItem = wiResponse.data;

        console.log(`✅ Encontrado: #${workItem.id} - ${workItem.fields['System.Title']}\n`);

        // 2. Transformar
        const fields = workItem.fields;
        const tags = fields['System.Tags'] || '';
        const tagArray = tags.split(';').map(t => t.trim());

        console.log(`📊 Tags: ${tags}`);
        console.log(`📊 Type: ${fields['System.WorkItemType']}`);
        console.log(`📊 State: ${fields['System.State']}`);
        console.log(`📊 Sprint: ${fields['System.IterationPath']}\n`);

        // Extraer países
        const countries = tagArray
            .map(tag => COUNTRY_MAP[tag.toUpperCase()])
            .filter(Boolean);

        if (countries.length === 0) countries.push('No definido');

        // Crear detalle
        const type = TYPE_MAP[fields['System.WorkItemType']] || 'Requerimiento';
        const sprint = (fields['System.IterationPath'] || '').split('\\').find(p => p.toLowerCase().includes('sprint')) || 'Sin sprint';

        const details = countries.map(country => ({
            id: workItem.id.toString(),
            type: type,
            branch: workItem.id.toString(),
            description: fields['System.Title'] || '',
            observation: country,
            proyect: 'Sir Legacy',
            qaRegional: fields['System.State'] === 'Done' ? 'Completado' : '',
            sprint: sprint
        }));

        const newVersion = {
            version: '1.58.1.1',
            date: '17/12/2025',
            year: 2025,
            sprint: sprint,
            description: '',
            details: details
        };

        console.log('📋 Versión creada:');
        console.log(JSON.stringify(newVersion, null, 2));

        // 3. Actualizar document.json
        console.log('\n💾 Actualizando document.json...');
        const documentContent = await fs.readFile(CONFIG.documentPath, 'utf8');
        const document = JSON.parse(documentContent);

        const existingIndex = document.data.findIndex(v => v.version === '1.58.1.1');
        if (existingIndex >= 0) {
            console.log('⚠️  Versión ya existe. Actualizando...');
            document.data[existingIndex] = newVersion;
        } else {
            console.log('✨ Agregando nueva versión');
            document.data.push(newVersion);
        }

        await fs.writeFile(CONFIG.documentPath, JSON.stringify(document, null, 2), 'utf8');

        console.log('\n✅ ¡Sincronización completada!');
        console.log(`📈 Versión 1.58.1.1 con ${details.length} detalles`);
        console.log(`🔄 Recarga http://localhost:3000\n`);

    } catch (error) {
        console.error('\n❌ Error:', error.response?.data || error.message);
    }
}

syncNow();
