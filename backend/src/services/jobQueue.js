/**
 * Background Job Queue System
 * 
 * Processes async work triggered by the Event Bus.
 * Jobs are queued in-memory with retry logic and a dead queue for failures.
 * 
 * Rules:
 *   - max_concurrent_jobs = 5
 *   - retry_max = 3
 *   - cooldown = 30 seconds between retries
 *   - failed jobs after max retries → dead_queue
 *   - NEVER blocks the main thread
 */

const logger = require('../utils/logger');

const MAX_CONCURRENT = 5;
const MAX_RETRIES = 3;
const RETRY_COOLDOWN_MS = 30000;

// ─── Job States ──────────────────────────────────────────────
const JOB_STATUS = {
  QUEUED: 'queued',
  RUNNING: 'running',
  COMPLETED: 'completed',
  FAILED: 'failed',
  DEAD: 'dead',
};

class JobQueue {
  constructor() {
    this._queue = [];         // pending jobs
    this._running = new Map(); // jobId → job
    this._deadQueue = [];      // permanently failed
    this._completed = [];      // recently completed (keep last 100)
    this._workers = new Map(); // workerName → handler function
    this._jobIdCounter = 0;
    this._processing = false;
    this._stats = {
      totalQueued: 0,
      totalCompleted: 0,
      totalFailed: 0,
      totalDead: 0,
    };
  }

  /**
   * Register a named worker that processes a specific job type
   */
  registerWorker(name, handler) {
    this._workers.set(name, handler);
    logger.info(`[JobQueue] Worker registered: ${name}`);
  }

  /**
   * Add a job to the queue
   * @param {string} type - worker name to handle this job
   * @param {object} data - job payload
   * @param {object} opts - { priority: number (higher = sooner) }
   * @returns {string} jobId
   */
  enqueue(type, data = {}, opts = {}) {
    const job = {
      id: `job-${++this._jobIdCounter}-${Date.now()}`,
      type,
      data,
      priority: opts.priority || 0,
      status: JOB_STATUS.QUEUED,
      attempts: 0,
      createdAt: Date.now(),
      lastAttemptAt: null,
      error: null,
    };

    this._queue.push(job);
    this._stats.totalQueued++;

    // Sort by priority descending
    this._queue.sort((a, b) => b.priority - a.priority);

    // Trigger processing
    this._process();

    return job.id;
  }

  /**
   * Process queued jobs up to concurrency limit
   */
  _process() {
    if (this._processing) return;
    this._processing = true;

    setImmediate(() => {
      try {
        while (this._running.size < MAX_CONCURRENT && this._queue.length > 0) {
          const job = this._queue.shift();
          if (!job) break;

          const worker = this._workers.get(job.type);
          if (!worker) {
            logger.warn(`[JobQueue] No worker for job type: ${job.type}`);
            job.status = JOB_STATUS.DEAD;
            job.error = `No worker registered for type: ${job.type}`;
            this._deadQueue.push(job);
            this._stats.totalDead++;
            continue;
          }

          job.status = JOB_STATUS.RUNNING;
          job.attempts++;
          job.lastAttemptAt = Date.now();
          this._running.set(job.id, job);

          // Execute async, catch all errors
          this._executeJob(job, worker);
        }
      } finally {
        this._processing = false;
      }
    });
  }

  async _executeJob(job, worker) {
    try {
      await worker(job.data);
      job.status = JOB_STATUS.COMPLETED;
      this._running.delete(job.id);
      this._stats.totalCompleted++;

      // Keep last 100 completed
      this._completed.push({ id: job.id, type: job.type, completedAt: Date.now() });
      if (this._completed.length > 100) this._completed.shift();

      // Process next
      this._process();
    } catch (err) {
      this._running.delete(job.id);
      job.error = err.message;
      job.status = JOB_STATUS.FAILED;

      if (job.attempts >= MAX_RETRIES) {
        // Move to dead queue
        job.status = JOB_STATUS.DEAD;
        this._deadQueue.push(job);
        this._stats.totalDead++;
        logger.error(`[JobQueue] Job ${job.id} (${job.type}) dead after ${MAX_RETRIES} attempts: ${err.message}`);
      } else {
        // Re-queue with cooldown
        this._stats.totalFailed++;
        logger.warn(`[JobQueue] Job ${job.id} (${job.type}) failed attempt ${job.attempts}/${MAX_RETRIES}: ${err.message}`);
        setTimeout(() => {
          job.status = JOB_STATUS.QUEUED;
          this._queue.push(job);
          this._process();
        }, RETRY_COOLDOWN_MS);
      }

      this._process();
    }
  }

  /**
   * Get queue statistics
   */
  getStats() {
    return {
      queued: this._queue.length,
      running: this._running.size,
      deadQueue: this._deadQueue.length,
      recentCompleted: this._completed.length,
      ...this._stats,
      workers: Array.from(this._workers.keys()),
    };
  }

  /**
   * Get dead queue contents
   */
  getDeadQueue() {
    return this._deadQueue.map(j => ({
      id: j.id,
      type: j.type,
      error: j.error,
      attempts: j.attempts,
      createdAt: j.createdAt,
      lastAttemptAt: j.lastAttemptAt,
    }));
  }

  /**
   * Retry all dead queue jobs (requeue them with reset attempts)
   */
  retryDeadQueue() {
    const count = this._deadQueue.length;
    while (this._deadQueue.length > 0) {
      const job = this._deadQueue.shift();
      job.attempts = 0;
      job.status = JOB_STATUS.QUEUED;
      job.error = null;
      this._queue.push(job);
    }
    this._process();
    return count;
  }

  /**
   * Clear the dead queue
   */
  clearDeadQueue() {
    const count = this._deadQueue.length;
    this._deadQueue = [];
    return count;
  }
}

// Singleton
const jobQueue = new JobQueue();

module.exports = { jobQueue, JOB_STATUS };
