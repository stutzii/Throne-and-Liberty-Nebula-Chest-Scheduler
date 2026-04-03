/**
 * Core Scheduler Logic
 * Handles spawn detection for 20-minute intervals with paired chest+moonstone events
 */

class SpawnScheduler {
  constructor(spawnData, sourceTimezone = 'Europe/Berlin') {
    this.spawnData = spawnData;
    this.sourceTimezone = sourceTimezone;
    this.userTimezone = this.detectTimezone();    
    // Cache parsed spawns (expand once, never reparse)
    this._parsedSpawns = null;
    // Cache for memoization
    this._cachedLastSpawn = null;
    this._cachedNextSpawn = null;
    this._lastCacheTime = null;
    this._timeSinceLast = 0;
    this._timeUntilNext = 0;  }

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
   * Get current time in source timezone as total seconds since midnight
   */
  getCurrentSourceSeconds() {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: this.sourceTimezone,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
    const timeStr = formatter.format(now);
    const [hour, minute, second] = timeStr.split(':').map(Number);
    return hour * 3600 + minute * 60 + second;
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
   * Cached after first call
   */
  parseScheduleData() {
    if (this._parsedSpawns) return this._parsedSpawns;
    
    this._parsedSpawns = this.spawnData.flatMap((spawn) => {
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
    
    return this._parsedSpawns;
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
   * Calculate seconds until spawn starts, considering day of week in source timezone
   */
  minutesUntilSpawn(spawn, sourceTimeStr) {
    const currentDay = this.getCurrentSourceWeekday();
    const currentSeconds = this.getCurrentSourceSeconds();
    const spawnSeconds = this.timeToMinutes(spawn.time) * 60;

    const dayDiff = (spawn.dayOfWeek - currentDay + 7) % 7;
    let deltaSeconds = dayDiff * 24 * 3600 + (spawnSeconds - currentSeconds);

    // If spawn is for today and already passed, roll to next weekly cycle
    if (dayDiff === 0 && deltaSeconds <= 0) {
      deltaSeconds += 7 * 24 * 3600;
    }

    return deltaSeconds;
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
   * Cached per second
   */
  getNextSpawns(limit = 5) {
    const currentSeconds = this.getCurrentSourceSeconds();
    const currentDay = this.getCurrentSourceWeekday();
    const spawns = this.parseScheduleData();

    const upcoming = spawns
      .map((spawn) => {
        const spawnSeconds = this.timeToMinutes(spawn.time) * 60;
        
        // Skip active spawns
        if (spawn.dayOfWeek === currentDay && currentSeconds >= spawnSeconds && currentSeconds < spawnSeconds + 20 * 60) {
          return null;
        }
        
        // Skip same-day past spawns
        if (spawn.dayOfWeek === currentDay && spawnSeconds <= currentSeconds) {
          return null;
        }

        const dayDiff = (spawn.dayOfWeek - currentDay + 7) % 7;
        let deltaSeconds = dayDiff * 24 * 3600 + (spawnSeconds - currentSeconds);

        if (dayDiff === 0 && deltaSeconds <= 0) {
          deltaSeconds += 7 * 24 * 3600;
        }

        return {
          ...spawn,
          minutesUntil: deltaSeconds,
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
   * Get seconds since the last spawn ended
   */
  getTimeSinceLastSpawn() {
    const currentSeconds = this.getCurrentSourceSeconds();
    const spawns = this.parseScheduleData();

    // Find the most recent spawn end time before current time
    let latestEndSeconds = -Infinity;
    for (const spawn of spawns) {
      const spawnSeconds = this.timeToMinutes(spawn.time) * 60;
      const endSeconds = spawnSeconds + 20 * 60; // 20 minutes in seconds
      if (endSeconds <= currentSeconds) {
        latestEndSeconds = Math.max(latestEndSeconds, endSeconds);
      }
    }

    if (latestEndSeconds === -Infinity) {
      // No past spawns found (e.g., very early), return 0
      return 0;
    }

    return currentSeconds - latestEndSeconds;
  }

  /**
   * Get all critical timer values in one call
   * Memoized per second to avoid redundant calculations
   */
  getTimerSnapshot() {
    const currentSeconds = this.getCurrentSourceSeconds();
    const currentDay = this.getCurrentSourceWeekday();

    // Return cached values if within same second
    if (this._lastCacheTime === currentSeconds) {
      return {
        timeSinceLast: this._timeSinceLast,
        timeUntilNext: this._timeUntilNext,
        lastSpawn: this._cachedLastSpawn,
        nextSpawn: this._cachedNextSpawn,
      };
    }

    const spawns = this.parseScheduleData();
    let activeSpawn = null;
    let activeSpawnStart = null;

    // Prefer active spawn if any (current window is 20 minutes)
    for (const spawn of spawns) {
      if (spawn.dayOfWeek !== currentDay) continue;
      const spawnSeconds = this.timeToMinutes(spawn.time) * 60;
      if (currentSeconds >= spawnSeconds && currentSeconds < spawnSeconds + 20 * 60) {
        activeSpawn = spawn;
        activeSpawnStart = spawnSeconds;
        break;
      }
    }

    let lastSpawn = null;
    let timeSinceLast = 0;

    if (activeSpawn) {
      lastSpawn = activeSpawn;
      timeSinceLast = currentSeconds - activeSpawnStart;
    } else {
      // Find the most recent ended spawn, accounting for day-of-week
      let latestEndSeconds = -Infinity;
      for (const spawn of spawns) {
        if (spawn.dayOfWeek === currentDay) {
          const spawnSeconds = this.timeToMinutes(spawn.time) * 60;
          const endSeconds = spawnSeconds + 20 * 60;
          if (endSeconds <= currentSeconds && endSeconds > latestEndSeconds) {
            latestEndSeconds = endSeconds;
            lastSpawn = spawn;
          }
        }
      }

      if (lastSpawn === null) {
        for (let daysBack = 1; daysBack <= 7; daysBack++) {
          const targetDay = (currentDay - daysBack + 7) % 7;
          for (const spawn of spawns) {
            if (spawn.dayOfWeek === targetDay) {
              const spawnSeconds = this.timeToMinutes(spawn.time) * 60;
              const endSeconds = spawnSeconds + 20 * 60;
              if (endSeconds > latestEndSeconds) {
                latestEndSeconds = endSeconds;
                lastSpawn = spawn;
              }
            }
          }
          if (lastSpawn !== null) break;
        }
      }

      timeSinceLast = latestEndSeconds === -Infinity ? 0 : currentSeconds - latestEndSeconds;
    }

    // Find next spawn
    let nextSpawn = null;
    let minDelta = Infinity;

    for (const spawn of spawns) {
      const spawnSeconds = this.timeToMinutes(spawn.time) * 60;
      const dayDiff = (spawn.dayOfWeek - currentDay + 7) % 7;
      let deltaSeconds = dayDiff * 24 * 3600 + (spawnSeconds - currentSeconds);

      if (dayDiff === 0 && deltaSeconds <= 0) {
        deltaSeconds += 7 * 24 * 3600;
      }

      if (deltaSeconds > 0 && deltaSeconds < minDelta) {
        minDelta = deltaSeconds;
        nextSpawn = spawn;
      }
    }

    const timeUntilNext = nextSpawn ? minDelta : 0;

    // Cache results by second
    this._lastCacheTime = currentSeconds;
    this._timeSinceLast = timeSinceLast;
    this._timeUntilNext = timeUntilNext;
    this._cachedLastSpawn = lastSpawn;
    this._cachedNextSpawn = nextSpawn;

    return { timeSinceLast, timeUntilNext, lastSpawn, nextSpawn };
  }

  /**
   * Get the last spawn that ended
   */
  getLastSpawn() {
    const currentTime = this.getCurrentSourceTimeString();
    const currentMins = this.timeToMinutes(currentTime);
    const spawns = this.parseScheduleData();

    let latestSpawn = null;
    let latestEnd = -Infinity;
    for (const spawn of spawns) {
      const spawnMins = this.timeToMinutes(spawn.time);
      const endMins = spawnMins + 20;
      if (endMins <= currentMins && endMins > latestEnd) {
        latestEnd = endMins;
        latestSpawn = spawn;
      }
    }

    return latestSpawn;
  }

  /**
   * Get the next upcoming spawn
   */
  getNextSpawn() {
    const nextSpawns = this.getNextSpawns(1);
    return nextSpawns.length > 0 ? nextSpawns[0] : null;
  }

  /**
   * Format seconds into a readable time string
   * e.g., 3665 seconds -> "1h 1m 5s"
   * Only shows seconds if total is less than 60 seconds
   */
  formatCountdown(seconds) {
    if (seconds < 0) return "Past";
    
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    // Only show seconds if total is less than 60 seconds
    const showSeconds = seconds < 60;
    
    if (hours === 0 && mins === 0) {
      return showSeconds ? `${secs}s` : `0m`;
    } else if (hours === 0) {
      return showSeconds ? `${mins}m ${secs}s` : `${mins}m`;
    } else {
      return showSeconds ? `${hours}h ${mins}m ${secs}s` : `${hours}h ${mins}m`;
    }
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
