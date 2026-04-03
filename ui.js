/**
 * UI Rendering
 * Handles DOM manipulation and card rendering
 */

class UIRenderer {
  constructor(scheduler) {
    this.scheduler = scheduler;
    this.nextSpawnsContainer = document.getElementById("next-spawns");
    
    // Cache DOM references for timer updates (no re-querying)
    this.lastTimerValue = document.getElementById("last-timer-value");
    this.nextTimerValue = document.getElementById("next-timer-value");
    this.currentTimerValue = document.getElementById("current-timer-value");
    this.currentDateElement = document.getElementById("current-date");
    this.currentTzElement = document.getElementById("current-timezone");
    this.lastSpawnLocations = document.getElementById("last-spawn-locations");
    this.nextSpawnLocations = document.getElementById("next-spawn-locations");
    
    // Cache last displayed spawns to detect changes
    this._lastDisplayedLastSpawn = null;
    this._lastDisplayedNextSpawn = null;
    this._lastDisplayedNextSpawns = null;
  }

  /**
   * Render spawn timers - only updates changed values, not full rebuild
   */
  renderSpawnTimers() {
    const snapshot = this.scheduler.getTimerSnapshot();
    const { timeSinceLast, timeUntilNext, lastSpawn, nextSpawn } = snapshot;

    // Update timer values only (text content, not HTML rebuild)
    if (this.lastTimerValue) {
      this.lastTimerValue.textContent = this.scheduler.formatCountdown(timeSinceLast);
    }

    if (this.nextTimerValue) {
      this.nextTimerValue.textContent = this.scheduler.formatCountdown(timeUntilNext);
    }

    // Update current time
    if (this.currentTimerValue) {
      const now = new Date();
      const timeStr = now.toLocaleTimeString("en-US", {
        hour12: false,
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
      this.currentTimerValue.textContent = timeStr;
    }

    // Update date only if element exists and cache is empty
    if (this.currentDateElement && !this._dateUpdated) {
      const now = new Date();
      const dateStr = now.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
      });
      this.currentDateElement.textContent = dateStr;
      this._dateUpdated = true;
    }

    // Update timezone only if element exists and cache is empty
    if (this.currentTzElement && !this._tzUpdated) {
      const tz = this.scheduler.getDisplayTimezone();
      this.currentTzElement.textContent = `Timezone: ${tz}`;
      this._tzUpdated = true;
    }

    // Update last spawn locations only if spawn changed (compare by ID, not reference)
    const lastSpawnId = lastSpawn ? lastSpawn.id : null;
    const lastDisplayedId = this._lastDisplayedLastSpawn ? this._lastDisplayedLastSpawn.id : null;
    if (lastSpawn && lastSpawnId !== lastDisplayedId) {
      if (this.lastSpawnLocations) {
        this.lastSpawnLocations.innerHTML = `
          <div class="spawn-item chest-item">
            <span class="spawn-icon">📦</span>
            <span class="spawn-location">${lastSpawn.chest.location}</span>
          </div>
          <div class="spawn-item moonstone-item">
            <span class="spawn-icon">💎</span>
            <span class="spawn-location">${lastSpawn.moonstone.location}</span>
          </div>
        `;
      }
      this._lastDisplayedLastSpawn = lastSpawn;
    }

    // Update next spawn locations only if spawn changed (compare by ID, not reference)
    const nextSpawnId = nextSpawn ? nextSpawn.id : null;
    const nextDisplayedId = this._lastDisplayedNextSpawn ? this._lastDisplayedNextSpawn.id : null;
    if (nextSpawn && nextSpawnId !== nextDisplayedId) {
      if (this.nextSpawnLocations) {
        this.nextSpawnLocations.innerHTML = `
          <div class="spawn-item chest-item">
            <span class="spawn-icon">📦</span>
            <span class="spawn-location">${nextSpawn.chest.location}</span>
          </div>
          <div class="spawn-item moonstone-item">
            <span class="spawn-icon">💎</span>
            <span class="spawn-location">${nextSpawn.moonstone.location}</span>
          </div>
        `;
      }
      this._lastDisplayedNextSpawn = nextSpawn;
    }
  }

  /**
   * Render next spawns into the next-spawns container
   * Only updates when spawn list actually changes
   */
  renderNextSpawns(spawns) {
    if (!this.nextSpawnsContainer) {
      console.warn("Element #next-spawns not found");
      return;
    }

    // Check if spawn list has actually changed
    const spawnIds = spawns.map(s => s.id).join(',');
    if (this._lastDisplayedNextSpawns === spawnIds) {
      return; // No change, skip re-render
    }

    if (spawns.length === 0) {
      this.nextSpawnsContainer.innerHTML = `
        <div class="no-spawns">
          No more spawns scheduled for today.
        </div>
      `;
    } else {
      // Show a compact list of upcoming spawns
      const html = spawns
        .map((spawn) => this.createCombinedSpawnCard(spawn, "next", true))
        .join("");
      this.nextSpawnsContainer.innerHTML = html;
    }

    this._lastDisplayedNextSpawns = spawnIds;
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
  // Removed - now integrated into renderSpawnTimers()

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
  }

  renderAll() {
    this.renderSpawnTimers();
    // Get next spawns starting from the one after the immediate next
    const allNext = this.scheduler.getNextSpawns(this.upcomingCount + 1);
    const next = allNext.slice(1); // Skip the immediate next
    this.renderNextSpawns(next);
  }
}

// Will be initialized in index.html
let uiRenderer;
