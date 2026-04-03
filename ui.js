/**
 * UI Rendering
 * Handles DOM manipulation and card rendering
 */

class UIRenderer {
  constructor(scheduler) {
    this.scheduler = scheduler;
    this.activeSpawnsContainer = document.getElementById("current-spawns");
    this.nextSpawnsContainer = document.getElementById("next-spawns");
  }

  /**
   * Render active spawns into the current-spawns container
   */
  renderActiveSpawns(spawns) {
    if (!this.activeSpawnsContainer) {
      console.warn("Element #current-spawns not found");
      return;
    }

    if (spawns.length === 0) {
      this.activeSpawnsContainer.innerHTML = `
        <div class="no-spawns">
          No active spawns right now. Check back soon!
        </div>
      `;
      return;
    }

    // Only show the current active spawn as a single combined card
    const spawn = spawns[0];
    const html = this.createCombinedSpawnCard(spawn, "active");
    this.activeSpawnsContainer.innerHTML = html;
  }

  /**
   * Render next spawns into the next-spawns container
   */
  renderNextSpawns(spawns) {
    if (!this.nextSpawnsContainer) {
      console.warn("Element #next-spawns not found");
      return;
    }

    if (spawns.length === 0) {
      this.nextSpawnsContainer.innerHTML = `
        <div class="no-spawns">
          -
        </div>
      `;
      return;
    }

    // Show a compact list of upcoming spawns
    const html = spawns
      .map((spawn) => this.createCombinedSpawnCard(spawn, "next", true))
      .join("");
    this.nextSpawnsContainer.innerHTML = html;
  }

  /**
   * Create HTML for a combined spawn card (chest + moonstone paired)
   */
  createCombinedSpawnCard(spawn, status, compact = false) {
    const { time, chest, moonstone, minutesUntil, id } = spawn;

    const statusClass = `card-${status}`;
    const compactClass = compact ? "compact" : "";
    const badgeText = status === "active" ? "ACTIVE" : "NEXT";

    let countdownHtml = "";
    if (status === "next" && minutesUntil !== undefined) {
      const formatted = this.scheduler.formatCountdown(minutesUntil);
      countdownHtml = `
        <div class="countdown">
          <span class="countdown-label">In:</span>
          <span class="countdown-value" data-countdown-id="${id}">${formatted}</span>
        </div>
      `;
    } else if (status === "active") {
      countdownHtml = `
        <div class="spawn-window">
          <span class="window-label">Spawning for:</span>
          <span class="window-value" data-window-id="${id}">20m</span>
        </div>
      `;
    }

    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const dayLabel = spawn.dayOfWeek !== undefined ? dayNames[spawn.dayOfWeek] : "";
    const showDay = status === "next" && dayLabel;

    return `
      <div class="card ${statusClass} combined-spawn ${compactClass}" data-spawn-id="${id}">
        <div class="card-badge">${badgeText}</div>
        
        <div class="card-time">
          <h3>${time}</h3>
          ${showDay ? `<span class="card-day">${dayLabel}</span>` : ""}
        </div>

        <div class="spawn-pair">
          <div class="spawn-item chest-item">
            <span class="spawn-icon">📦</span>
            <span class="spawn-location">${chest.location}</span>
          </div>
          <div class="spawn-separator">+</div>
          <div class="spawn-item moonstone-item">
            <span class="spawn-icon">💎</span>
            <span class="spawn-location">${moonstone.location}</span>
          </div>
        </div>

        ${countdownHtml}
      </div>
    `;
  }

  /**
   * Update the timezone display
   */
  updateTimezoneDisplay() {
    const tzElement = document.getElementById("timezone-display");
    if (tzElement) {
      const tz = this.scheduler.getDisplayTimezone();
      tzElement.textContent = `Timezone: ${tz}`;
    }
  }

  /**
   * Update the current time display
   */
  updateTimeDisplay() {
    const timeElement = document.getElementById("current-time");
    if (timeElement) {
      const currentTime = this.scheduler.getCurrentTimeString();
      const now = new Date();
      const dateStr = now.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
      });

      timeElement.innerHTML = `
        <span class="date">${dateStr}</span>
        <span class="time">${currentTime}</span>
      `;
    }
  }

  /**
   * Initialize UI on page load
   */
  init() {
    this.upcomingCount = 3;

    // Control for selecting number of upcoming spawns
    const controls = document.getElementById("upcoming-controls");
    if (controls) {
      const updateDisplay = () => {
        const countSpan = document.getElementById("current-count");
        if (countSpan) countSpan.textContent = this.upcomingCount;
      };

      updateDisplay();

      // Preset buttons
      document.getElementById("preset-0").addEventListener("click", () => {
        this.upcomingCount = 0;
        updateDisplay();
        this.renderAll();
      });

      document.getElementById("preset-1").addEventListener("click", () => {
        this.upcomingCount = 1;
        updateDisplay();
        this.renderAll();
      });

      document.getElementById("preset-3").addEventListener("click", () => {
        this.upcomingCount = 3;
        updateDisplay();
        this.renderAll();
      });

      document.getElementById("preset-5").addEventListener("click", () => {
        this.upcomingCount = 5;
        updateDisplay();
        this.renderAll();
      });

      // Increase
      document.getElementById("increase").addEventListener("click", () => {
        if (this.upcomingCount < 20) {
          this.upcomingCount++;
          updateDisplay();
          this.renderAll();
        }
      });

      // Decrease
      document.getElementById("decrease").addEventListener("click", () => {
        if (this.upcomingCount > 0) {
          this.upcomingCount--;
          updateDisplay();
          this.renderAll();
        }
      });
    }

    this.renderAll();
    this.updateTimezoneDisplay();
    this.updateTimeDisplay();

    // Update time display every second
    setInterval(() => {
      this.updateTimeDisplay();
    }, 1000);
  }

  renderAll() {
    const active = this.scheduler.getCurrentSpawns();
    const next = this.scheduler.getNextSpawns(this.upcomingCount);

    this.renderActiveSpawns(active);
    this.renderNextSpawns(next);
  }
}

// Will be initialized in index.html
let uiRenderer;
