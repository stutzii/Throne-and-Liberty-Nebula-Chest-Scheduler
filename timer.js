/**
 * Timer Management
 * Handles real-time updates and countdown intervals
 */

class TimerManager {
  constructor(scheduler, uiRenderer) {
    this.scheduler = scheduler;
    this.ui = uiRenderer;
    this.timerInterval = null;
    this.isRunning = false;
  }

  /**
   * Start the main timer loop
   * Updates displays every second
   */
  start() {
    if (this.isRunning) {
      console.warn("Timer already running");
      return;
    }

    this.isRunning = true;

    // Initial render
    this.update();

    // Update every 1 second
    this.timerInterval = setInterval(() => {
      this.update();
    }, 1000);

    console.log("Timer started");
  }

  /**
   * Stop the timer loop
   */
  stop() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
    this.isRunning = false;
    console.log("Timer stopped");
  }

  /**
   * Single update cycle
   * Recalculate spawns and re-render
   */
  update() {
    // Re-render all sections from UI renderer for a consistent state
    this.ui.renderAll();

    // Update all countdown timers
    this.updateCountdowns();
  }

  /**
   * Update all countdown displays
   * Called every second
   */
  updateCountdowns() {
    // Update "time until next spawn" countdowns
    const allCountdownElements = document.querySelectorAll("[data-countdown-id]");
    allCountdownElements.forEach((element) => {
      const spawnId = element.getAttribute("data-countdown-id");
      const spawn = this.findSpawnById(spawnId);

      if (spawn) {
        const currentTime = this.scheduler.getCurrentTimeString();
        const minutesUntil = this.scheduler.minutesUntilSpawn(spawn, currentTime);
        const formatted = this.scheduler.formatCountdown(minutesUntil);
        element.textContent = formatted;
      }
    });

    // Update active spawn window countdowns (20 minute window)
    const allWindowElements = document.querySelectorAll("[data-window-id]");
    allWindowElements.forEach((element) => {
      const spawnId = element.getAttribute("data-window-id");
      const spawn = this.findSpawnById(spawnId);

      if (spawn) {
        const currentTime = this.scheduler.getCurrentTimeString();
        const currentMins = this.scheduler.timeToMinutes(currentTime);
        const spawnMins = this.scheduler.timeToMinutes(spawn.time);
        const minutesRemaining = 20 - (currentMins - spawnMins);
        
        if (minutesRemaining > 0) {
          element.textContent = `${Math.ceil(minutesRemaining)}m`;
        } else {
          element.textContent = "0m";
        }
      }
    });
  }

  /**
   * Find a spawn by ID in the schedule
   */
  findSpawnById(spawnId) {
    const spawns = this.scheduler.parseScheduleData();
    return spawns.find((s) => s.id === spawnId);
  }

  /**
   * Toggle timer on/off
   */
  toggle() {
    if (this.isRunning) {
      this.stop();
    } else {
      this.start();
    }
  }
}

// Will be initialized after UI renderer is created
let timerManager;
