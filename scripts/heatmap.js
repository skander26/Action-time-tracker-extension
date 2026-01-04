/**
 * heatmap.js
 * GitHub-style Activity Heatmap Component
 */

class ActivityHeatmap {
  constructor(containerId, data = {}) {
    this.container = document.getElementById(containerId);
    this.data = data;
    this.tooltip = document.getElementById('heatmap-tooltip');
    this.init();
  }

  init() {
    if (!this.container) return;
    this.render();
    this.attachEventListeners();
  }

  /**
   * Generate dates for the last N days
   */
  generateDates(days = 60) {
    const dates = [];
    const today = new Date();
    
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      dates.push(date);
    }
    
    return dates;
  }

  /**
   * Get activity level (0-5) based on time spent
   */
  getActivityLevel(ms) {
    if (!ms || ms === 0) return 0;
    
    const minutes = ms / 1000 / 60;
    
    if (minutes < 5) return 1;
    if (minutes < 15) return 2;
    if (minutes < 30) return 3;
    if (minutes < 60) return 4;
    return 5;
  }

  /**
   * Get total time for a specific date from storage data
   */
  getTimeForDate(dateStr) {
    // Loop through all weeks in data to find the date
    for (const weekKey in this.data) {
      const weekData = this.data[weekKey];
      if (weekData[dateStr]) {
        // Sum all domain times for this date
        return Object.values(weekData[dateStr]).reduce((sum, time) => sum + time, 0);
      }
    }
    return 0;
  }

  /**
   * Format date as YYYY-MM-DD
   */
  formatDate(date) {
    return date.toISOString().split('T')[0];
  }

  /**
   * Format time in human readable format
   */
  formatTime(ms) {
    if (!ms) return 'No activity';
    
    const minutes = Math.floor(ms / 1000 / 60);
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    
    if (hours > 0) return `${hours}h ${mins}m active`;
    if (minutes > 0) return `${minutes}m active`;
    return 'Less than 1m';
  }

  /**
   * Get month name abbreviation
   */
  getMonthName(date) {
    return date.toLocaleDateString('en-US', { month: 'short' });
  }

  /**
   * Render the heatmap
   */
  render() {
    const dates = this.generateDates(60);
    
    // Group dates by week for grid layout
    const weeks = [];
    let currentWeek = [];
    
    // Find the starting day (we want to start from Sunday)
    const firstDate = dates[0];
    const firstDay = firstDate.getDay();
    
    // Add empty cells for alignment
    for (let i = 0; i < firstDay; i++) {
      currentWeek.push(null);
    }
    
    dates.forEach(date => {
      currentWeek.push(date);
      if (currentWeek.length === 7) {
        weeks.push(currentWeek);
        currentWeek = [];
      }
    });
    
    // Add remaining dates
    if (currentWeek.length > 0) {
      while (currentWeek.length < 7) {
        currentWeek.push(null);
      }
      weeks.push(currentWeek);
    }

    // Create month labels
    const monthLabels = this.createMonthLabels(dates);
    
    // Create day labels
    const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    
    // Build HTML
    let html = '<div class="heatmap-wrapper">';
    
    // Month labels
    html += '<div class="heatmap-months">';
    monthLabels.forEach(month => {
      html += `<div class="heatmap-month">${month}</div>`;
    });
    html += '</div>';
    
    html += '<div class="heatmap-container-with-labels">';
    
    // Day labels
    html += '<div class="heatmap-days">';
    dayLabels.forEach((day, index) => {
      // Only show Mon, Wed, Fri to avoid clutter
      if (index === 1 || index === 3 || index === 5) {
        html += `<div class="heatmap-day">${day}</div>`;
      } else {
        html += '<div class="heatmap-day"></div>';
      }
    });
    html += '</div>';
    
    // Heatmap grid
    html += '<div class="heatmap-grid">';
    
    weeks.forEach(week => {
      week.forEach(date => {
        if (date === null) {
          html += '<div class="heatmap-cell" style="opacity: 0; pointer-events: none;"></div>';
        } else {
          const dateStr = this.formatDate(date);
          const ms = this.getTimeForDate(dateStr);
          const level = this.getActivityLevel(ms);
          const formattedDate = date.toLocaleDateString('en-US', { 
            weekday: 'short', 
            year: 'numeric', 
            month: 'short', 
            day: 'numeric' 
          });
          
          html += `<div class="heatmap-cell" 
                        data-level="${level}" 
                        data-date="${dateStr}"
                        data-formatted-date="${formattedDate}"
                        data-time="${ms}"
                        title="${formattedDate}: ${this.formatTime(ms)}">
                   </div>`;
        }
      });
    });
    
    html += '</div></div>';
    
    // Legend
    html += '<div class="heatmap-legend">';
    html += '<span class="heatmap-legend-label">Less</span>';
    html += '<div class="heatmap-legend-scale">';
    for (let i = 0; i <= 5; i++) {
      html += `<div class="heatmap-legend-cell" data-level="${i}"></div>`;
    }
    html += '</div>';
    html += '<span class="heatmap-legend-label">More</span>';
    html += '</div>';
    
    html += '</div>';
    
    this.container.innerHTML = html;
  }

  /**
   * Create month labels for the heatmap
   */
  createMonthLabels(dates) {
    const labels = [];
    let lastMonth = -1;
    
    dates.forEach(date => {
      const month = date.getMonth();
      if (month !== lastMonth) {
        labels.push(this.getMonthName(date));
        lastMonth = month;
      }
    });
    
    return labels;
  }

  /**
   * Attach event listeners for tooltips
   */
  attachEventListeners() {
    const cells = this.container.querySelectorAll('.heatmap-cell[data-date]');
    
    cells.forEach(cell => {
      cell.addEventListener('mouseenter', (e) => this.showTooltip(e));
      cell.addEventListener('mouseleave', () => this.hideTooltip());
    });
  }

  /**
   * Show tooltip on hover
   */
  showTooltip(event) {
    const cell = event.target;
    const formattedDate = cell.dataset.formattedDate;
    const time = parseInt(cell.dataset.time);
    
    const tooltipDate = this.tooltip.querySelector('.heatmap-tooltip-date');
    const tooltipValue = this.tooltip.querySelector('.heatmap-tooltip-value');
    
    tooltipDate.textContent = formattedDate;
    tooltipValue.textContent = this.formatTime(time);
    
    // Position tooltip
    const rect = cell.getBoundingClientRect();
    this.tooltip.style.left = `${rect.left + window.scrollX + rect.width / 2}px`;
    this.tooltip.style.top = `${rect.top + window.scrollY - 10}px`;
    this.tooltip.style.transform = 'translate(-50%, -100%)';
    
    this.tooltip.classList.add('visible');
  }

  /**
   * Hide tooltip
   */
  hideTooltip() {
    this.tooltip.classList.remove('visible');
  }

  /**
   * Update heatmap with new data
   */
  update(data) {
    this.data = data;
    this.render();
    this.attachEventListeners();
  }
}

// Export for use in dashboard.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ActivityHeatmap;
}