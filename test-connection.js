// Script de prueba rápida para verificar conexión y buscar versión
require('dotenv').config();
const axios = require('axios');

const CONFIG = {
    organization: process.env.AZURE_DEVOPS_ORG || 'Grupo-KFC',
    project: process.env.AZURE_DEVOPS_PROJECT || 'SIR',
    token: process.env.AZURE_DEVOPS_TOKEN,
};

async function testConnection() {
    try {
        const baseUrl = `https://dev.azure.com/${CONFIG.organization}/${CONFIG.project}/_apis`;

        const client = axios.create({
            baseURL: baseUrl,
            headers: {
                'Authorization': `Basic ${Buffer.from(`:${CONFIG.token}`).toString('base64')}`,
                'Content-Type': 'application/json'
            },
            params: {
                'api-version': '7.0'
            }
        });

        console.log('🔍 Buscando work items con tag: V.1.58.1.1...\n');

        const wiql = {
            query: `
        SELECT [System.Id], [System.Title], [System.WorkItemType], [System.Tags]
        FROM WorkItems
        WHERE [System.Tags] CONTAINS 'V.1.58.1.1'
        AND [System.TeamProject] = '${CONFIG.project}'
        ORDER BY [System.Id] DESC
      `
        };

        const response = await client.post('/wit/wiql', wiql);
        const workItems = response.data.workItems || [];

        console.log(`✅ Conexión exitosa con Azure DevOps`);
        console.log(`📊 Work items encontrados: ${workItems.length}\n`);

        if (workItems.length > 0) {
            console.log('Work items:');
            workItems.forEach(wi => {
                console.log(`  - ID: ${wi.id}`);
            });
        } else {
            console.log('⚠️  No hay work items con el tag "V.1.58.1.1"');
            console.log('\n💡 Para que funcione:');
            console.log('   1. Ve a Azure DevOps');
            console.log('   2. Abre work items que quieras incluir');
            console.log('   3. Agrégales el tag: V.1.58.1.1');
            console.log('   4. Vuelve a ejecutar el sync');
        }

    } catch (error) {
        console.error('❌ Error:', error.response?.data?.message || error.message);
    }
}

testConnection();
