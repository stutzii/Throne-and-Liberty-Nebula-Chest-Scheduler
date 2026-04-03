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
    // Get all timer values at once (memoized fetch)
    const snapshot = this.scheduler.getTimerSnapshot();

    // Update timer display values only
    const lastValue = document.getElementById("last-timer-value");
    if (lastValue) {
      lastValue.textContent = this.scheduler.formatCountdown(snapshot.timeSinceLast);
    }

    const nextValue = document.getElementById("next-timer-value");
    if (nextValue) {
      nextValue.textContent = this.scheduler.formatCountdown(snapshot.timeUntilNext);
    }

    const currentValue = document.getElementById("current-timer-value");
    if (currentValue) {
      const now = new Date();
      const timeStr = now.toLocaleTimeString("en-US", {
        hour12: false,
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
      currentValue.textContent = timeStr;
    }

    // Update "time until next spawn" countdowns in upcoming list
    const allCountdownElements = document.querySelectorAll("[data-countdown-id]");
    allCountdownElements.forEach((element) => {
      const spawnId = element.getAttribute("data-countdown-id");
      const spawn = this.findSpawnById(spawnId);

      if (spawn) {
        const currentSeconds = this.scheduler.getCurrentSourceSeconds();
        const currentDay = this.scheduler.getCurrentSourceWeekday();
        const spawnSeconds = this.scheduler.timeToMinutes(spawn.time) * 60;
        const dayDiff = (spawn.dayOfWeek - currentDay + 7) % 7;
        let deltaSeconds = dayDiff * 24 * 3600 + (spawnSeconds - currentSeconds);

        if (dayDiff === 0 && deltaSeconds <= 0) {
          deltaSeconds += 7 * 24 * 3600;
        }

        const formatted = this.scheduler.formatCountdown(deltaSeconds);
        element.textContent = formatted;
      }
    });

    // Update active spawn window countdowns (20 minute window)
    const allWindowElements = document.querySelectorAll("[data-window-id]");
    allWindowElements.forEach((element) => {
      const spawnId = element.getAttribute("data-window-id");
      const spawn = this.findSpawnById(spawnId);

      if (spawn) {
        const currentSeconds = this.scheduler.getCurrentSourceSeconds();
        const spawnSeconds = this.scheduler.timeToMinutes(spawn.time) * 60;
        const secondsRemaining = 20 * 60 - (currentSeconds - spawnSeconds);
        
        if (secondsRemaining > 0) {
          element.textContent = `${Math.ceil(secondsRemaining / 60)}m`;
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
