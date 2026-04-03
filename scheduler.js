/**
 * Core Scheduler Logic
 * Handles spawn detection for 20-minute intervals with paired chest+moonstone events
 */

class SpawnScheduler {
  constructor(spawnData, sourceTimezone = 'Europe/Berlin') {
    this.spawnData = spawnData;
    this.sourceTimezone = sourceTimezone;
    this.userTimezone = this.detectTimezone();
  }

  /**
   * Detect the user's local timezone
   */
  detectTimezone() {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  }

  /**
   * Get a day-of-week number from weekday name string
   */
  dayNameToIndex(dayName) {
    const mapping = {
      sunday: 0,
      monday: 1,
      tuesday: 2,
      wednesday: 3,
      thursday: 4,
      friday: 5,
      saturday: 6,
    };
    return mapping[dayName.toLowerCase()] ?? 0;
  }

  /**
   * Get current weekday number in source timezone (CET/Europe/Paris)
   */
  getCurrentSourceWeekday() {
    const formatted = new Intl.DateTimeFormat('en-US', {
      timeZone: this.sourceTimezone,
      weekday: 'long',
    }).format(new Date());
    return this.dayNameToIndex(formatted);
  }

  /**
   * Get current time string in source timezone (CET)
   */
  getCurrentSourceTimeString() {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: this.sourceTimezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    return formatter.format(new Date());
  }

  /**
   * Get current time as HH:MM string in user's timezone
   */
  getCurrentTimeString() {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: this.userTimezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    const [hour, minute] = formatter.format(now).split(':');
    return `${hour}:${minute}`;
  }

  /**
   * Convert minutes since midnight to HH:MM string
   */
  minutesToTimeString(minutes) {
    const normalized = ((minutes % (24 * 60)) + 24 * 60) % (24 * 60);
    const h = Math.floor(normalized / 60);
    const m = normalized % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  /**
   * Parse raw spawn data and attach metadata
   * Expand each row into 20-minute increments (00, 20, 40)
   */
  parseScheduleData() {
    return this.spawnData.flatMap((spawn) => {
      const baseMins = this.timeToMinutes(spawn.time);
      return [0, 20, 40].map((offset) => {
        const time = this.minutesToTimeString(baseMins + offset);
        return {
          ...spawn,
          time,
          id: `${time}-day${spawn.dayOfWeek}`,
        };
      });
    });
  }

  /**
   * Get current time as HH:MM string in user's timezone
   */
  getCurrentTimeString() {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: this.userTimezone,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    
    const [hour, minute] = formatter.format(now).split(":");
    return `${hour}:${minute}`;
  }

  /**
   * Convert a time string to minutes since midnight
   */
  timeToMinutes(timeStr) {
    const [hours, mins] = timeStr.split(":").map(Number);
    return hours * 60 + mins;
  }

  /**
   * Get the current weekday for schedule filtering (0 = Sunday, 6 = Saturday)
   */
  getCurrentWeekday() {
    return new Date().getDay();
  }

  /**
   * Check if a spawn is currently active (20-minute window)
   * Spawns occur at :00, :20, :40 of each hour using source timezone context.
   */
  isSpawnActive(spawn, sourceTimeStr) {
    const currentDay = this.getCurrentSourceWeekday();
    if (spawn.dayOfWeek !== currentDay) return false;

    const currentMins = this.timeToMinutes(sourceTimeStr);
    const spawnMins = this.timeToMinutes(spawn.time);

    // Spawn is active for 20 minutes from its time
    return currentMins >= spawnMins && currentMins < spawnMins + 20;
  }

  /**
   * Calculate minutes until spawn starts, considering day of week in source timezone
   */
  minutesUntilSpawn(spawn, sourceTimeStr) {
    const currentDay = this.getCurrentSourceWeekday();
    const currentMins = this.timeToMinutes(sourceTimeStr);
    const spawnMins = this.timeToMinutes(spawn.time);

    const dayDiff = (spawn.dayOfWeek - currentDay + 7) % 7;
    let delta = dayDiff * 24 * 60 + (spawnMins - currentMins);

    // If spawn is for today and already passed, roll to next weekly cycle
    if (dayDiff === 0 && delta <= 0) {
      delta += 7 * 24 * 60;
    }

    return delta;
  }

  /**
   * Get all spawns currently active.
   */
  getCurrentSpawns() {
    const currentTime = this.getCurrentSourceTimeString();
    const currentDay = this.getCurrentSourceWeekday();
    const spawns = this.parseScheduleData();

    return spawns.filter((spawn) => spawn.dayOfWeek === currentDay && this.isSpawnActive(spawn, currentTime));
  }

  /**
   * Get next N upcoming spawns (not including currently active ones)
   */
  getNextSpawns(limit = 5) {
    const currentTime = this.getCurrentSourceTimeString();
    const currentDay = this.getCurrentSourceWeekday();
    const currentMins = this.timeToMinutes(currentTime);
    const spawns = this.parseScheduleData();

    const upcoming = spawns
      .filter((spawn) => !this.isSpawnActive(spawn, currentTime))
      .map((spawn) => {
        // Skip same-day spawns that have passed in source timezone.
        if (spawn.dayOfWeek === currentDay && this.timeToMinutes(spawn.time) <= currentMins) {
          return null;
        }

        return {
          ...spawn,
          minutesUntil: this.minutesUntilSpawn(spawn, currentTime),
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.minutesUntil - b.minutesUntil)
      .slice(0, limit);

    return upcoming;
  }

  /**
   * Get all spawns sorted by proximity to current time
   */
  getAllSpawns() {
    const currentSpawns = this.getCurrentSpawns();
    const nextSpawns = this.getNextSpawns(999); // Get all upcoming
    
    return { current: currentSpawns, next: nextSpawns };
  }

  /**
   * Get the single current active spawn (or null)
   */
  getCurrentActiveSpawn() {
    const currentSpawns = this.getCurrentSpawns();
    return currentSpawns.length > 0 ? currentSpawns[0] : null;
  }

  /**
   * Get the next active spawn (the one coming up)
   */
  getNextActiveSpawn() {
    const nextSpawns = this.getNextSpawns(1);
    return nextSpawns.length > 0 ? nextSpawns[0] : null;
  }

  /**
   * Format minutes into a readable time string
   * e.g., 125 minutes -> "2h 5m"
   */
  formatCountdown(minutes) {
    if (minutes < 0) return "Past";
    
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    
    if (hours === 0) {
      return `${mins}m`;
    }
    
    return `${hours}h ${mins}m`;
  }

  /**
   * Get user's current timezone for display
   */
  getDisplayTimezone() {
    return this.userTimezone;
  }
}

// Initialize scheduler with global data
const scheduler = new SpawnScheduler(SPAWN_SCHEDULE);
