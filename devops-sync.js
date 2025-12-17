#!/usr/bin/env node

// ================================================
// Azure DevOps Timeline Sync Script
// Sincroniza work items de Azure DevOps a document.json
// ================================================

require('dotenv').config();
const axios = require('axios');
const prompts = require('prompts');
const fs = require('fs').promises;
const path = require('path');

// ================================================
// Configuración
// ================================================

const CONFIG = {
    organization: process.env.AZURE_DEVOPS_ORG || 'Grupo-KFC',
    project: process.env.AZURE_DEVOPS_PROJECT || 'SIR',
    token: process.env.AZURE_DEVOPS_TOKEN,
    apiVersion: '7.0',
    documentPath: path.join(__dirname, 'data', 'document.json')
};

// Mapeo de países
const COUNTRY_MAP = {
    'CO': 'Colombia',
    'ECU': 'Ecuador',
    'EC': 'Ecuador',
    'BR': 'Brasil',
    'ES': 'España',
    'ESP': 'España',
    'VE': 'Venezuela',
    'VEN': 'Venezuela',
    'CHI': 'Chile',
    'CH': 'Chile',
    'AR': 'Argentina',
    'RE': 'Regional'
};

// Mapeo de tipos
const TYPE_MAP = {
    'Bug': 'Defecto',
    'Defect': 'Defecto',
    'User Story': 'Requerimiento',
    'Feature': 'Requerimiento',
    'Task': 'Requerimiento'
};

// ================================================
// Azure DevOps API Client
// ================================================

class AzureDevOpsClient {
    constructor(config) {
        this.config = config;
        this.baseUrl = `https://dev.azure.com/${config.organization}/${config.project}/_apis`;

        // Validar token
        if (!config.token) {
            throw new Error('❌ AZURE_DEVOPS_TOKEN no está configurado. Revisa tu archivo .env');
        }

        // Configurar axios
        this.client = axios.create({
            baseURL: this.baseUrl,
            headers: {
                'Authorization': `Basic ${Buffer.from(`:${config.token}`).toString('base64')}`,
                'Content-Type': 'application/json'
            },
            params: {
                'api-version': config.apiVersion
            }
        });
    }

    /**
     * Buscar work items por tag de versión
     */
    async getWorkItemsByVersion(versionTag) {
        try {
            console.log(`🔍 Buscando work items con tag: ${versionTag}...`);

            // WIQL query para buscar por tag
            const wiql = {
                query: `SELECT [System.Id] FROM WorkItems WHERE [System.Tags] CONTAINS '${versionTag}' AND [System.TeamProject] = '${this.config.project}' ORDER BY [System.Id] DESC`
            };

            const response = await this.client.post('/wit/wiql', wiql);
            const workItemIds = response.data.workItems.map(wi => wi.id);

            if (workItemIds.length === 0) {
                console.log('⚠️  No se encontraron work items con ese tag');
                return [];
            }

            console.log(`✅ Encontrados ${workItemIds.length} work items`);

            // Obtener detalles completos de los work items
            const workItems = await this.getWorkItemDetails(workItemIds);
            return workItems;

        } catch (error) {
            if (error.response?.status === 401) {
                throw new Error('❌ Error de autenticación. Verifica tu token de Azure DevOps');
            }
            throw new Error(`❌ Error al buscar work items: ${error.message}`);
        }
    }

    /**
     * Obtener detalles completos de work items
     */
    async getWorkItemDetails(ids) {
        try {
            const idsParam = ids.join(',');
            const fields = [
                'System.Id',
                'System.Title',
                'System.WorkItemType',
                'System.Tags',
                'System.State',
                'System.IterationPath',
                'System.Parent',
                'System.AreaPath'
            ];

            const response = await this.client.get('/wit/workitems', {
                params: {
                    ids: idsParam,
                    fields: fields.join(',')
                }
            });

            return response.data.value;
        } catch (error) {
            throw new Error(`❌ Error al obtener detalles: ${error.message}`);
        }
    }
}

// ================================================
// Utilidades de Transformación
// ================================================

/**
 * Extraer países de los tags
 */
function extractCountries(tags) {
    if (!tags) return ['No definido'];

    const tagArray = tags.split(';').map(t => t.trim());
    const countries = tagArray
        .map(tag => COUNTRY_MAP[tag.toUpperCase()])
        .filter(Boolean);

    return countries.length > 0 ? countries : ['No definido'];
}

/**
 * Extraer sprint del iteration path
 */
function extractSprint(iterationPath) {
    if (!iterationPath) return 'Sin sprint';

    // Formato típico: "SIR\\Sprint 21" o "SIR\\2025\\Sprint 21"
    const parts = iterationPath.split('\\');
    const sprintPart = parts.find(p => p.toLowerCase().includes('sprint'));

    return sprintPart || 'Sin sprint';
}

/**
 * Determinar proyecto basado en area path o tags
 */
function determineProject(areaPath, tags) {
    // Por defecto desde area path
    if (areaPath) {
        if (areaPath.includes('Legacy')) return 'Sir Legacy';
        if (areaPath.includes('Back')) return 'Sir Back';
        if (areaPath.includes('Integration')) return 'Sir Integration';
    }

    // O desde tags si hay info
    if (tags) {
        if (tags.includes('Legacy')) return 'Sir Legacy';
        if (tags.includes('Back')) return 'Sir Back';
        if (tags.includes('Integration')) return 'Sir Integration';
    }

    return 'Sir Legacy'; // Default
}

/**
 * Transformar work item de Azure DevOps a formato document.json
 */
function transformWorkItem(workItem) {
    const fields = workItem.fields;
    const countries = extractCountries(fields['System.Tags']);
    const type = TYPE_MAP[fields['System.WorkItemType']] || 'Requerimiento';
    const sprint = extractSprint(fields['System.IterationPath']);
    const project = determineProject(fields['System.AreaPath'], fields['System.Tags']);

    // Crear un detalle por cada país encontrado
    return countries.map(country => ({
        id: workItem.id.toString(),
        type: type,
        branch: workItem.id.toString(),
        description: fields['System.Title'] || '',
        observation: country,
        proyect: project,
        qaRegional: fields['System.State'] === 'Done' ? 'Completado' : '',
        sprint: sprint
    }));
}

/**
 * Transformar múltiples work items a una versión
 */
function transformToVersion(workItems, versionNumber, versionDate, year) {
    // Aplanar todos los detalles
    const allDetails = workItems.flatMap(wi => transformWorkItem(wi));

    // Obtener el sprint más común o el primero
    const sprints = allDetails.map(d => d.sprint).filter(s => s !== 'Sin sprint');
    const mainSprint = sprints.length > 0 ? sprints[0] : 'Sin sprint';

    return {
        version: versionNumber,
        date: versionDate,
        year: year,
        sprint: mainSprint,
        description: '',
        details: allDetails
    };
}

// ================================================
// Gestión de document.json
// ================================================

/**
 * Leer document.json
 */
async function readDocument() {
    try {
        const content = await fs.readFile(CONFIG.documentPath, 'utf8');
        return JSON.parse(content);
    } catch (error) {
        throw new Error(`❌ Error al leer document.json: ${error.message}`);
    }
}

/**
 * Guardar document.json
 */
async function saveDocument(document) {
    try {
        const content = JSON.stringify(document, null, 2);
        await fs.writeFile(CONFIG.documentPath, content, 'utf8');
        console.log('✅ document.json actualizado correctamente');
    } catch (error) {
        throw new Error(`❌ Error al guardar document.json: ${error.message}`);
    }
}

/**
 * Agregar o actualizar versión en document.json
 */
async function updateDocument(newVersion) {
    const document = await readDocument();

    // Buscar si la versión ya existe
    const existingIndex = document.data.findIndex(v => v.version === newVersion.version);

    if (existingIndex >= 0) {
        console.log(`⚠️  La versión ${newVersion.version} ya existe. Se actualizará.`);
        document.data[existingIndex] = newVersion;
    } else {
        console.log(`✨ Agregando nueva versión ${newVersion.version}`);
        document.data.push(newVersion);
    }

    // Ordenar por versión (opcional)
    document.data.sort((a, b) => {
        const vA = a.version.split('.').map(Number);
        const vB = b.version.split('.').map(Number);
        for (let i = 0; i < Math.max(vA.length, vB.length); i++) {
            if ((vA[i] || 0) !== (vB[i] || 0)) {
                return (vA[i] || 0) - (vB[i] || 0);
            }
        }
        return 0;
    });

    await saveDocument(document);
}

// ================================================
// Interfaz Interactiva
// ================================================

async function promptUserInput() {
    console.log('\n📋 Sincronización de Azure DevOps → Timeline SIR\n');

    const questions = [
        {
            type: 'text',
            name: 'version',
            message: '¿Qué versión deseas sincronizar? (ej: V.1.58.1.1 o 1.58.1.1)',
            validate: value => value.length > 0 ? true : 'Debes ingresar una versión'
        },
        {
            type: 'text',
            name: 'date',
            message: '¿Qué fecha tiene esta versión? (formato: DD/MM/YYYY)',
            initial: () => {
                const today = new Date();
                const dd = String(today.getDate()).padStart(2, '0');
                const mm = String(today.getMonth() + 1).padStart(2, '0');
                const yyyy = today.getFullYear();
                return `${dd}/${mm}/${yyyy}`;
            },
            validate: value => {
                const regex = /^\d{2}\/\d{2}\/\d{4}$/;
                return regex.test(value) ? true : 'Formato debe ser DD/MM/YYYY';
            }
        },
        {
            type: 'number',
            name: 'year',
            message: '¿Año de la versión?',
            initial: new Date().getFullYear(),
            validate: value => value >= 2020 && value <= 2030 ? true : 'Año inválido'
        }
    ];

    return await prompts(questions);
}

// ================================================
// Main Function
// ================================================

async function main() {
    try {
        console.log('🚀 Iniciando sincronización con Azure DevOps...\n');

        // 1. Obtener input del usuario
        const input = await promptUserInput();

        if (!input.version || !input.date || !input.year) {
            console.log('❌ Sincronización cancelada');
            process.exit(0);
        }

        // Normalizar versión (agregar V. si no tiene)
        let versionTag = input.version.trim();
        if (!versionTag.startsWith('V.')) {
            versionTag = `V.${versionTag}`;
        }

        const versionNumber = versionTag.replace('V.', '');

        console.log(`\n📌 Versión: ${versionNumber}`);
        console.log(`📅 Fecha: ${input.date}`);
        console.log(`📆 Año: ${input.year}`);
        console.log(`🏷️  Tag de búsqueda: ${versionTag}\n`);

        // 2. Conectar a Azure DevOps
        const client = new AzureDevOpsClient(CONFIG);

        // 3. Buscar work items
        const workItems = await client.getWorkItemsByVersion(versionTag);

        if (workItems.length === 0) {
            console.log('⚠️  No hay work items para sincronizar');
            process.exit(0);
        }

        // 4. Mostrar resumen
        console.log(`\n📊 Resumen de Work Items encontrados:\n`);
        workItems.forEach(wi => {
            const type = TYPE_MAP[wi.fields['System.WorkItemType']] || 'Otro';
            const typeIcon = type === 'Defecto' ? '🐛' : '📋';
            console.log(`  ${typeIcon} #${wi.id} - ${wi.fields['System.Title']}`);
        });

        // 5. Confirmar
        const { confirm } = await prompts({
            type: 'confirm',
            name: 'confirm',
            message: `\n¿Deseas agregar estos ${workItems.length} work items a la versión ${versionNumber}?`,
            initial: true
        });

        if (!confirm) {
            console.log('❌ Sincronización cancelada');
            process.exit(0);
        }

        // 6. Transformar y actualizar
        console.log('\n⚙️  Transformando datos...');
        const newVersion = transformToVersion(workItems, versionNumber, input.date, input.year);

        console.log('💾 Actualizando document.json...');
        await updateDocument(newVersion);

        // 7. Éxito
        console.log('\n✅ ¡Sincronización completada exitosamente!');
        console.log(`\n📈 Versión ${versionNumber} agregada con ${newVersion.details.length} detalles`);
        console.log(`🔄 Recarga el timeline en http://localhost:3000 para ver los cambios\n`);

    } catch (error) {
        console.error(`\n${error.message}\n`);
        process.exit(1);
    }
}

// Ejecutar
if (require.main === module) {
    main();
}

module.exports = { AzureDevOpsClient, transformWorkItem, transformToVersion };
