// ================================================
// SIR Timeline - Modular JavaScript
// Version Management System
// ================================================

/**
 * Timeline Application - Main Module
 */
const TimelineApp = (() => {
  // State management
  let state = {
    allVersions: [],
    filteredVersions: [],
    selectedVersion: null,
    activeCountry: null,
    searchQuery: '',
    selectedCountries: [] // For multi-select country filtering
  };

  // Configuration
  const config = {
    dataUrl: '/data/document.json',
    countries: [
      { name: 'Venezuela', code: 'VEN', flag: '🇻🇪' },
      { name: 'Ecuador', code: 'ECU', flag: '🇪🇨' },
      { name: 'Chile', code: 'CHI', flag: '🇨🇱' },
      { name: 'Argentina', code: 'ARG', flag: '🇦🇷' },
      { name: 'Brasil', code: 'BRA', flag: '🇧🇷' },
      { name: 'Colombia', code: 'COL', flag: '🇨🇴' },
      { name: 'España', code: 'ESP', flag: '🇪🇸' }
    ]
  };

  /**
   * Initialize the application
   */
  const init = async () => {
    try {
      await loadData();

      // Set default date filter: last 30 days
      setDefaultDateFilter();

      renderUI();
      attachEventListeners();
      console.log('✅ Timeline App initialized successfully');
    } catch (error) {
      console.error('❌ Error initializing app:', error);
      showError('Error al cargar la aplicación. Por favor, recarga la página.');
    }
  };

  /**
   * Set default date filter to last 30 days
   */
  const setDefaultDateFilter = () => {
    const today = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(today.getDate() - 30);

    // Set end date to tomorrow to ensure today's versions are included
    const tomorrow = new Date();
    tomorrow.setDate(today.getDate() + 1);

    // Format dates as YYYY-MM-DD for input fields
    const formatDateForInput = (date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    const startDateInput = document.getElementById('start-date');
    const endDateInput = document.getElementById('end-date');

    if (startDateInput && endDateInput) {
      startDateInput.value = formatDateForInput(thirtyDaysAgo);
      endDateInput.value = formatDateForInput(tomorrow);

      // Apply the filter
      filterByDateRange(formatDateForInput(thirtyDaysAgo), formatDateForInput(tomorrow));
    }
  };

  /**
   * Load data from JSON file
   */
  const loadData = async () => {
    try {
      const response = await fetch(config.dataUrl);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();

      // Transform data to internal format
      state.allVersions = data.data.map((version, index) => ({
        id: index + 1,
        version: version.version,
        date: version.date,
        dateObj: parseDate(version.date),
        description: version.description,
        details: version.details || [],
        stats: calculateVersionStats(version.details || [])
      }));

      // Sort by date
      state.allVersions.sort((a, b) => a.dateObj - b.dateObj);
      state.filteredVersions = [...state.allVersions];

      console.log(`📊 Loaded ${state.allVersions.length} versions`);
    } catch (error) {
      console.error('Error loading data:', error);
      throw error;
    }
  };

  /**
   * Parse date from DD/MM/YYYY format
   */
  const parseDate = (dateString) => {
    const parts = dateString.split('/');
    if (parts.length === 3) {
      // Create date at noon to avoid timezone issues
      const date = new Date(parts[2], parts[1] - 1, parts[0]);
      date.setHours(12, 0, 0, 0);
      return date;
    }
    return new Date();
  };

  /**
   * Format date to DD/MM/YYYY
   */
  const formatDate = (date) => {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  /**
   * Calculate statistics for a version
   */
  const calculateVersionStats = (details) => {
    const stats = {
      total: details.length,
      bugs: 0,
      requirements: 0,
      byCountry: {}
    };

    details.forEach(detail => {
      const type = detail.type || 'Sin tipo';
      const country = detail.observation || 'No definido';

      // Handle both 'Bug' and 'Defecto' as bugs
      const isBug = type === 'Bug' || type === 'Defecto';
      const isRequirement = type === 'Requerimiento';

      if (isBug) stats.bugs++;
      if (isRequirement) stats.requirements++;

      if (!stats.byCountry[country]) {
        stats.byCountry[country] = { bugs: 0, requirements: 0, total: 0 };
      }

      stats.byCountry[country].total++;
      if (isBug) stats.byCountry[country].bugs++;
      if (isRequirement) stats.byCountry[country].requirements++;
    });

    return stats;
  };

  /**
   * Render the entire UI
   */
  const renderUI = () => {
    renderCountries();
    renderTimeline();
    if (state.selectedVersion) {
      renderDetails();
      renderSummary();
    }
  };

  /**
   * Render country flags
   */
  const renderCountries = () => {
    const container = document.getElementById('countries-container');
    if (!container) return;

    container.innerHTML = config.countries.map(country => `
      <div class="country-flag ${state.activeCountry === country.code ? 'active' : ''}" 
           data-country="${country.code}"
           title="${country.name}">
        ${country.flag}
      </div>
    `).join('');
  };

  /**
   * Render timeline
   */
  const renderTimeline = () => {
    const container = document.getElementById('timeline-items-container');
    if (!container) return;

    const versions = state.filteredVersions;

    if (versions.length === 0) {
      container.innerHTML = '<p class="text-center">No se encontraron versiones</p>';
      return;
    }

    container.innerHTML = versions.map((version, index) => `
      <div class="timeline-item ${state.selectedVersion?.id === version.id ? 'active' : ''}"
           data-version-id="${version.id}">
        <div class="timeline-circle">
          <div class="timeline-version">${version.version}</div>
        </div>
        <div class="timeline-date">${version.date}</div>
      </div>
    `).join('');
  };

  /**
   * Render details cards
   */
  const renderDetails = () => {
    const container = document.getElementById('details-container');
    if (!container || !state.selectedVersion) return;

    const version = state.selectedVersion;
    let details = version.details;

    // Filter by selected countries if any
    if (state.selectedCountries.length > 0) {
      details = details.filter(d =>
        state.selectedCountries.includes(d.observation)
      );
    }

    // Group by functionality and corrections
    const functionalities = details.filter(d => d.type === 'Requerimiento' || !d.type);
    const corrections = details.filter(d => d.type === 'Bug' || d.type === 'Defecto');

    // Calculate percentage based on the sum of both categories
    const totalItems = functionalities.length + corrections.length;
    const funcPercentage = totalItems > 0
      ? Math.round((functionalities.length / totalItems) * 100)
      : 0;
    const corrPercentage = totalItems > 0
      ? Math.round((corrections.length / totalItems) * 100)
      : 0;

    let html = '';

    // Functionalities Card
    if (functionalities.length > 0) {
      html += `
        <div class="details-card fade-in">
          <div class="card-header">
            <div class="card-title">
              Funcionalidades ${functionalities.length}
              <span class="card-percentage">${funcPercentage}%</span>
            </div>
          </div>
          <div class="card-content">
            ${functionalities.map(detail => renderDetailItem(detail, '📋')).join('')}
          </div>
        </div>
      `;
    }

    // Corrections Card
    if (corrections.length > 0) {
      html += `
        <div class="details-card fade-in">
          <div class="card-header">
            <div class="card-title">
              Correcciones ${corrections.length}
              <span class="card-percentage">${corrPercentage}%</span>
            </div>
          </div>
          <div class="card-content">
            ${corrections.map(detail => renderDetailItem(detail, '🪲')).join('')}
          </div>
        </div>
      `;
    }

    container.innerHTML = html;
  };

  /**
   * Render individual detail item
   */
  const renderDetailItem = (detail, icon) => {
    return `
      <div class="card-item">
        <div class="card-item-header">
          <span class="item-type">${detail.type || 'Sin tipo'}</span>
          <span class="item-badge">${icon}</span>
        </div>
        ${detail.branch ? `<div class="item-detail"><strong>Rama:</strong> ${detail.branch}</div>` : ''}
        ${detail.description ? `<div class="item-detail"><strong>Descripción:</strong> ${detail.description}</div>` : ''}
        ${detail.observation ? `<div class="item-detail"><strong>País:</strong> ${detail.observation}</div>` : ''}
        ${detail.proyect ? `<div class="item-detail"><strong>Proyecto:</strong> ${detail.proyect}</div>` : ''}
        ${detail.qaRegional ? `<div class="item-detail"><strong>QA Regional:</strong> ${detail.qaRegional}</div>` : ''}
      </div>
    `;
  };

  /**
   * Render summary section
   */
  const renderSummary = () => {
    const container = document.getElementById('country-summary');
    const statsContainer = document.getElementById('summary-stats');

    if (!container || !state.selectedVersion) return;

    const stats = state.selectedVersion.stats;

    // Update stats badges
    if (statsContainer) {
      statsContainer.innerHTML = `
        <div class="stat-badge">Requerimientos: ${stats.requirements} 📋</div>
        <div class="stat-badge">Bugs: ${stats.bugs} 🪲</div>
      `;
    }

    // Render country breakdown
    const countries = Object.keys(stats.byCountry);
    if (countries.length === 0) {
      container.innerHTML = '<p class="text-center">No hay datos por país</p>';
      return;
    }

    container.innerHTML = countries.map(country => {
      const countryStats = stats.byCountry[country];
      if (countryStats.total === 0) return '';

      const isSelected = state.selectedCountries.includes(country);
      return `
        <div class="country-card ${isSelected ? 'selected' : ''}" data-country="${country}">
          <div class="country-name">${country}</div>
          <div class="country-stats">
            Requerimientos: ${countryStats.requirements}<br>
            Bugs: ${countryStats.bugs}
          </div>
        </div>
      `;
    }).join('');
  };

  /**
   * Handle version selection
   */
  const selectVersion = (versionId) => {
    const version = state.allVersions.find(v => v.id === parseInt(versionId));
    if (version) {
      state.selectedVersion = version;
      renderUI();

      // Scroll to details
      const detailsSection = document.getElementById('details-container');
      if (detailsSection) {
        detailsSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  };

  /**
   * Filter by date range
   */
  const filterByDateRange = (startDate, endDate) => {
    if (!startDate || !endDate) {
      state.filteredVersions = [...state.allVersions];
    } else {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0); // Start of day

      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999); // End of day

      state.filteredVersions = state.allVersions.filter(version => {
        return version.dateObj >= start && version.dateObj <= end;
      });
    }

    renderTimeline();
  };

  /**
   * Filter by country
   */
  const filterByCountry = (countryCode) => {
    if (state.activeCountry === countryCode) {
      // Deselect country
      state.activeCountry = null;
      state.filteredVersions = [...state.allVersions];
    } else {
      // Select country
      state.activeCountry = countryCode;

      // Find country name mapping
      const countryMap = {
        'VEN': 'Venezuela',
        'ECU': 'Ecuador',
        'CHI': 'Chile',
        'ARG': 'Argentina',
        'BRA': 'Brasil',
        'COL': 'Colombia',
        'ESP': 'España'
      };

      const countryName = countryMap[countryCode];

      state.filteredVersions = state.allVersions.filter(version => {
        return version.details.some(detail =>
          detail.observation && detail.observation.includes(countryName)
        );
      });
    }

    renderUI();
  };

  /**
   * Toggle country selection for detail filtering
   */
  const toggleCountrySelection = (country, isMultiSelect) => {
    if (!state.selectedVersion) return;

    if (isMultiSelect) {
      // Multi-select mode (Ctrl+Click)
      const index = state.selectedCountries.indexOf(country);
      if (index > -1) {
        // Deselect
        state.selectedCountries.splice(index, 1);
      } else {
        // Add to selection
        state.selectedCountries.push(country);
      }
    } else {
      // Single select mode
      if (state.selectedCountries.length === 1 && state.selectedCountries[0] === country) {
        // Clicking the same country again - deselect all
        state.selectedCountries = [];
      } else {
        // Select only this country
        state.selectedCountries = [country];
      }
    }

    // Re-render details and summary to reflect filter
    renderDetails();
    renderSummary();
  };

  /**
   * Search versions
   */
  const searchVersions = (query) => {
    state.searchQuery = query.toLowerCase();

    if (!query) {
      hideSearchResults();
      return;
    }

    const results = state.allVersions.filter(version => {
      const versionMatch = version.version.toLowerCase().includes(state.searchQuery);
      const descMatch = version.description.toLowerCase().includes(state.searchQuery);
      const detailsMatch = version.details.some(detail =>
        (detail.description || '').toLowerCase().includes(state.searchQuery) ||
        (detail.branch || '').toLowerCase().includes(state.searchQuery)
      );

      return versionMatch || descMatch || detailsMatch;
    });

    displaySearchResults(results);
  };

  /**
   * Display search results
   */
  const displaySearchResults = (results) => {
    const container = document.getElementById('search-results');
    if (!container) return;

    if (results.length === 0) {
      container.innerHTML = '<div class="search-result-item">No se encontraron resultados</div>';
      container.classList.add('active');
      return;
    }

    container.innerHTML = results.map(version => `
      <div class="search-result-item" data-version-id="${version.id}">
        <strong>Versión ${version.version}</strong> - ${version.date}
        ${version.description ? `<br><small>${version.description}</small>` : ''}
      </div>
    `).join('');

    container.classList.add('active');
  };

  /**
   * Hide search results
   */
  const hideSearchResults = () => {
    const container = document.getElementById('search-results');
    if (container) {
      container.classList.remove('active');
    }
  };

  /**
   * Export to PDF - Modern Version
   */
  const exportToPDF = async () => {
    if (!state.selectedVersion) {
      alert('Por favor, selecciona una versión primero');
      return;
    }

    try {
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF();

      const version = state.selectedVersion;
      const pageWidth = 210; // A4 width in mm
      const margin = 15;
      const contentWidth = pageWidth - (margin * 2);

      // Colors
      const kfcRed = [228, 0, 43];
      const kfcBlack = [0, 0, 0];
      const gray = [136, 136, 136];
      const lightGray = [245, 245, 245];

      let y = 20;

      // ===== HEADER =====
      doc.setFillColor(...kfcRed);
      doc.rect(margin, y - 5, 30, 12, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(16);
      doc.setFont(undefined, 'bold');
      doc.text('KFC', margin + 15, y + 3, { align: 'center' });

      doc.setTextColor(...kfcBlack);
      doc.setFontSize(10);
      doc.setFont(undefined, 'normal');
      doc.text('DSI - Desarrollo Software Innovación', pageWidth - margin, y, { align: 'right' });

      y += 15;

      // Title
      doc.setFontSize(20);
      doc.setFont(undefined, 'bold');
      doc.text('Versiones SIR Regional 2025', pageWidth / 2, y, { align: 'center' });

      y += 8;
      doc.setFontSize(12);
      doc.setFont(undefined, 'normal');
      doc.setTextColor(...gray);
      doc.text('Sistema Integrado de Restaurantes', pageWidth / 2, y, { align: 'center' });

      y += 15;

      // Red line separator
      doc.setDrawColor(...kfcRed);
      doc.setLineWidth(0.5);
      doc.line(margin, y, pageWidth - margin, y);

      y += 10;

      // ===== VERSION INFO =====
      doc.setFontSize(16);
      doc.setTextColor(...kfcBlack);
      doc.setFont(undefined, 'bold');
      doc.text(`Versión ${version.version}`, margin, y);

      doc.setFontSize(10);
      doc.setFont(undefined, 'normal');
      doc.setTextColor(...gray);
      doc.text(`Fecha: ${version.date}`, pageWidth - margin, y, { align: 'right' });

      y += 15;

      // ===== RESUMEN DE VERSIÓN SECTION =====
      doc.setFontSize(14);
      doc.setFont(undefined, 'bold');
      doc.setTextColor(...kfcBlack);
      doc.text('Resumen de Versión', margin, y);

      y += 10;

      // Stats badges - calculate percentages
      const badgeWidth = 50;
      const badgeHeight = 10;
      const badgeSpacing = 5;

      // Calculate percentages
      const totalItems = version.stats.requirements + version.stats.bugs;
      const reqPercentage = totalItems > 0
        ? Math.round((version.stats.requirements / totalItems) * 100)
        : 0;
      const bugPercentage = totalItems > 0
        ? Math.round((version.stats.bugs / totalItems) * 100)
        : 0;

      // Requirements badge
      doc.setFillColor(...lightGray);
      doc.roundedRect(margin, y, badgeWidth, badgeHeight, 2, 2, 'F');
      doc.setDrawColor(...kfcRed);
      doc.setLineWidth(1);
      doc.line(margin, y, margin, y + badgeHeight);
      doc.setFontSize(10);
      doc.setFont(undefined, 'bold');
      doc.setTextColor(...kfcBlack);
      doc.text(`Requerimientos: ${version.stats.requirements} (${reqPercentage}%)`, margin + 3, y + 6.5);

      // Bugs badge
      doc.setFillColor(...lightGray);
      doc.roundedRect(margin + badgeWidth + badgeSpacing, y, badgeWidth + 15, badgeHeight, 2, 2, 'F');
      doc.setDrawColor(...kfcRed);
      doc.setLineWidth(1);
      doc.line(margin + badgeWidth + badgeSpacing, y, margin + badgeWidth + badgeSpacing, y + badgeHeight);
      doc.text(`Bugs: ${version.stats.bugs} (${bugPercentage}%)`, margin + badgeWidth + badgeSpacing + 3, y + 6.5);

      y += badgeHeight + 10;

      // Distribución por País title
      doc.setFontSize(12);
      doc.setFont(undefined, 'bold');
      doc.text('Distribución por País', margin, y);

      y += 8;

      // Country cards
      const countries = Object.keys(version.stats.byCountry).filter(
        country => version.stats.byCountry[country].total > 0
      );

      const cardWidth = (contentWidth - 10) / 2; // 2 columns with spacing
      const cardHeight = 18;
      let xPos = margin;
      let cardsInRow = 0;

      countries.forEach((country, index) => {
        const countryStats = version.stats.byCountry[country];

        if (y + cardHeight > 270) {
          doc.addPage();
          y = 20;
          xPos = margin;
          cardsInRow = 0;
        }

        // Card background
        doc.setFillColor(...lightGray);
        doc.roundedRect(xPos, y, cardWidth, cardHeight, 2, 2, 'F');

        // Left red border
        doc.setDrawColor(...kfcRed);
        doc.setLineWidth(1);
        doc.line(xPos, y, xPos, y + cardHeight);

        // Country name
        doc.setFontSize(11);
        doc.setFont(undefined, 'bold');
        doc.setTextColor(...kfcBlack);
        doc.text(country, xPos + 3, y + 6);

        // Stats
        doc.setFontSize(9);
        doc.setFont(undefined, 'normal');
        doc.setTextColor(...gray);
        doc.text(`Requerimientos: ${countryStats.requirements}`, xPos + 3, y + 11);
        doc.text(`Bugs: ${countryStats.bugs}`, xPos + 3, y + 15);

        cardsInRow++;
        if (cardsInRow === 2) {
          y += cardHeight + 5;
          xPos = margin;
          cardsInRow = 0;
        } else {
          xPos += cardWidth + 10;
        }
      });

      if (cardsInRow > 0) {
        y += cardHeight + 10;
      } else {
        y += 5;
      }

      // ===== DETALLES SECTION =====
      if (y + 30 > 270) {
        doc.addPage();
        y = 20;
      }

      y += 10;
      doc.setFontSize(14);
      doc.setFont(undefined, 'bold');
      doc.setTextColor(...kfcBlack);
      doc.text('Detalles Completos', margin, y);

      y += 10;

      // Group by type
      const functionalities = version.details.filter(d => d.type === 'Requerimiento' || !d.type);
      const corrections = version.details.filter(d => d.type === 'Bug' || d.type === 'Defecto');

      // Functionalities
      if (functionalities.length > 0) {
        if (y + 20 > 270) {
          doc.addPage();
          y = 20;
        }

        doc.setFontSize(12);
        doc.setFont(undefined, 'bold');
        doc.setTextColor(...kfcRed);
        doc.text(`Funcionalidades (${functionalities.length})`, margin, y);
        y += 8;

        functionalities.forEach((detail, index) => {
          if (y + 25 > 270) {
            doc.addPage();
            y = 20;
          }

          doc.setFontSize(9);
          doc.setFont(undefined, 'bold');
          doc.setTextColor(...kfcBlack);
          doc.text(`${index + 1}. ${detail.type || 'Requerimiento'}`, margin, y);
          y += 5;

          doc.setFont(undefined, 'normal');
          doc.setTextColor(...gray);
          doc.setFontSize(8);

          if (detail.branch) {
            doc.text(`Rama: ${detail.branch}`, margin + 3, y);
            y += 4;
          }
          if (detail.description) {
            const lines = doc.splitTextToSize(`Descripción: ${detail.description}`, contentWidth - 6);
            doc.text(lines, margin + 3, y);
            y += lines.length * 4;
          }
          if (detail.observation) {
            doc.text(`País: ${detail.observation}`, margin + 3, y);
            y += 4;
          }
          if (detail.proyect) {
            doc.text(`Proyecto: ${detail.proyect}`, margin + 3, y);
            y += 4;
          }

          y += 3;
        });
      }

      // Corrections
      if (corrections.length > 0) {
        if (y + 20 > 270) {
          doc.addPage();
          y = 20;
        }

        y += 5;
        doc.setFontSize(12);
        doc.setFont(undefined, 'bold');
        doc.setTextColor(...kfcRed);
        doc.text(`Correcciones (${corrections.length})`, margin, y);
        y += 8;

        corrections.forEach((detail, index) => {
          if (y + 25 > 270) {
            doc.addPage();
            y = 20;
          }

          doc.setFontSize(9);
          doc.setFont(undefined, 'bold');
          doc.setTextColor(...kfcBlack);
          doc.text(`${index + 1}. ${detail.type}`, margin, y);
          y += 5;

          doc.setFont(undefined, 'normal');
          doc.setTextColor(...gray);
          doc.setFontSize(8);

          if (detail.branch) {
            doc.text(`Rama: ${detail.branch}`, margin + 3, y);
            y += 4;
          }
          if (detail.description) {
            const lines = doc.splitTextToSize(`Descripción: ${detail.description}`, contentWidth - 6);
            doc.text(lines, margin + 3, y);
            y += lines.length * 4;
          }
          if (detail.observation) {
            doc.text(`País: ${detail.observation}`, margin + 3, y);
            y += 4;
          }
          if (detail.proyect) {
            doc.text(`Proyecto: ${detail.proyect}`, margin + 3, y);
            y += 4;
          }

          y += 3;
        });
      }

      // Footer on each page
      const pageCount = doc.internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(...gray);
        doc.setFont(undefined, 'normal');
        doc.text(
          `Grupo KFC - Mesa SIR  |  Generado: ${new Date().toLocaleDateString()}  |  Página ${i} de ${pageCount}`,
          pageWidth / 2,
          285,
          { align: 'center' }
        );
      }

      doc.save(`SIR-Timeline-v${version.version}.pdf`);
      console.log('✅ PDF moderno exportado exitosamente');
    } catch (error) {
      console.error('Error exporting PDF:', error);
      alert('Error al exportar PDF. Por favor, intenta de nuevo.');
    }
  };

  /**
   * Show error message
   */
  const showError = (message) => {
    alert(message);
  };

  /**
   * Attach event listeners
   */
  const attachEventListeners = () => {
    // Timeline items
    document.addEventListener('click', (e) => {
      const timelineItem = e.target.closest('.timeline-item');
      if (timelineItem) {
        const versionId = timelineItem.dataset.versionId;
        selectVersion(versionId);
      }

      // Country filter
      const countryFlag = e.target.closest('.country-flag');
      if (countryFlag) {
        const country = countryFlag.dataset.country;
        filterByCountry(country);
      }

      // Country card selection (for detail filtering)
      const countryCard = e.target.closest('.country-card');
      if (countryCard) {
        const country = countryCard.dataset.country;
        toggleCountrySelection(country, e.ctrlKey || e.metaKey);
      }

      // Search results
      const searchResult = e.target.closest('.search-result-item');
      if (searchResult) {
        const versionId = searchResult.dataset.versionId;
        selectVersion(versionId);
        hideSearchResults();
      }
    });

    // Date filter
    const filterBtn = document.getElementById('filter-dates');
    if (filterBtn) {
      filterBtn.addEventListener('click', () => {
        const startDate = document.getElementById('start-date')?.value;
        const endDate = document.getElementById('end-date')?.value;
        filterByDateRange(startDate, endDate);
      });
    }

    // Search
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        searchVersions(e.target.value);
      });

      // Hide search results when clicking outside
      document.addEventListener('click', (e) => {
        if (!searchInput.contains(e.target) && !document.getElementById('search-results')?.contains(e.target)) {
          hideSearchResults();
        }
      });
    }

    // Export PDF
    const exportBtn = document.getElementById('export-pdf');
    if (exportBtn) {
      exportBtn.addEventListener('click', exportToPDF);
    }
  };

  // Public API
  return {
    init,
    selectVersion,
    filterByCountry,
    exportToPDF
  };
})();

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', TimelineApp.init);
} else {
  TimelineApp.init();
}
