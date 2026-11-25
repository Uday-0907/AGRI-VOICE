/**
 * Scheduler Tests
 *
 * Tests the scheduler's initialization, deduplication, and stop behavior.
 * Actual cron job execution is NOT testable in unit tests — only lifecycle tested.
 * node-cron is mocked to prevent real job registration.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import cron from 'node-cron';
import {
  initializeScheduler,
  stopScheduler,
  isSchedulerRunning,
  getInFlightTaskCount,
} from '../../../src/config/scheduler.js';
import { weatherService } from '../../../src/modules/weather/services/weather.service.js';

const schedulerTestState = vi.hoisted(() => ({
  scheduledCallbacks: [] as Array<() => Promise<void>>,
  processActiveAlerts: vi.fn().mockResolvedValue(undefined),
}));

// Mock node-cron before tests. Capture the registered callbacks so lifecycle
// behavior (including in-flight accounting) can be exercised deterministically.
vi.mock('node-cron', () => ({
  default: {
    schedule: vi.fn((_expression: string, callback: () => Promise<void>) => {
      schedulerTestState.scheduledCallbacks.push(callback);
      return { stop: vi.fn() };
    }),
  },
}));

// Mock weather services to avoid DB connections
vi.mock('../../../src/modules/weather/services/weather.service.js', () => ({
  weatherService: {
    runIngestion: vi.fn().mockResolvedValue(undefined),
    pollAlerts: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../../../src/modules/weather/services/alert-processor.service.js', () => ({
  AlertProcessorService: class {
    processActiveAlerts = schedulerTestState.processActiveAlerts;
  },
}));

describe('Scheduler — lifecycle', () => {
  beforeEach(async () => {
    await stopScheduler();
    schedulerTestState.scheduledCallbacks.length = 0;
    vi.mocked(weatherService.runIngestion).mockReset().mockResolvedValue(undefined);
    vi.mocked(weatherService.pollAlerts).mockReset().mockResolvedValue(undefined);
    schedulerTestState.processActiveAlerts.mockReset().mockResolvedValue(undefined);
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await stopScheduler();
  });

  it('initializeScheduler() returns true on first call', () => {
    const result = initializeScheduler();
    expect(result).toBe(true);
  });

  it('initializeScheduler() returns false on second call (duplicate guard)', () => {
    const first = initializeScheduler();
    expect(first).toBe(true);
    const second = initializeScheduler();
    expect(second).toBe(false);
  });

  it('isSchedulerRunning() returns false before initialization', () => {
    expect(isSchedulerRunning()).toBe(false);
  });

  it('isSchedulerRunning() returns true after initialization', () => {
    initializeScheduler();
    expect(isSchedulerRunning()).toBe(true);
  });

  it('stopScheduler() resets isSchedulerRunning to false', () => {
    initializeScheduler();
    expect(isSchedulerRunning()).toBe(true);

    stopScheduler();
    expect(isSchedulerRunning()).toBe(false);
  });

  it('initializeScheduler() after stopScheduler() can re-start (returns true again)', () => {
    initializeScheduler();
    stopScheduler();

    const restarted = initializeScheduler();
    expect(restarted).toBe(true);
    expect(isSchedulerRunning()).toBe(true);
  });

  it('node-cron.schedule is called twice per initializeScheduler() call (ingestion + alerts)', () => {
    const scheduleSpy = vi.spyOn(cron, 'schedule');
    scheduleSpy.mockClear();

    initializeScheduler();
    expect(scheduleSpy).toHaveBeenCalledTimes(2);
  });

  it('node-cron.schedule is NOT called again on duplicate initialization', () => {
    const scheduleSpy = vi.spyOn(cron, 'schedule');
    scheduleSpy.mockClear();

    initializeScheduler();
    expect(scheduleSpy).toHaveBeenCalledTimes(2);

    initializeScheduler(); // duplicate
    expect(scheduleSpy).toHaveBeenCalledTimes(2); // no extra calls
  });
});

// ─── Scheduler — shutdown accounting ─────────────────────────────────────────

describe('Scheduler — shutdown accounting', () => {
  beforeEach(async () => {
    await stopScheduler();
    schedulerTestState.scheduledCallbacks.length = 0;
    vi.mocked(weatherService.runIngestion).mockReset().mockResolvedValue(undefined);
    vi.mocked(weatherService.pollAlerts).mockReset().mockResolvedValue(undefined);
    schedulerTestState.processActiveAlerts.mockReset().mockResolvedValue(undefined);
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await stopScheduler();
  });

  it('stopScheduler() with no in-flight tasks resolves immediately', async () => {
    initializeScheduler();
    const start = Date.now();
    await stopScheduler(1000);
    expect(Date.now() - start).toBeLessThan(500);
    expect(isSchedulerRunning()).toBe(false);
  });

  it('stopScheduler() leaves the counter at zero when no task is in flight', async () => {
    initializeScheduler();

    await stopScheduler(500);

    expect(getInFlightTaskCount()).toBe(0);
    expect(isSchedulerRunning()).toBe(false);
  });

  it('stopScheduler() preserves an in-flight count on timeout until the task finishes', async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    vi.mocked(weatherService.runIngestion).mockImplementation(() => gate);

    initializeScheduler();
    expect(schedulerTestState.scheduledCallbacks).toHaveLength(2);

    // Start the actual registered ingestion callback.
    const taskPromise = schedulerTestState.scheduledCallbacks[0]();
    expect(getInFlightTaskCount()).toBe(1);

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await stopScheduler(20);

    expect(isSchedulerRunning()).toBe(false);
    expect(getInFlightTaskCount()).toBe(1);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('1 task(s) still in flight')
    );

    release();
    await taskPromise;
    expect(getInFlightTaskCount()).toBe(0);
  });

  it('reinitialize after stop registers exactly 2 cron tasks again', () => {
    const scheduleSpy = vi.spyOn(cron, 'schedule');

    initializeScheduler();
    expect(scheduleSpy).toHaveBeenCalledTimes(2);

    stopScheduler();
    scheduleSpy.mockClear();

    initializeScheduler();
    expect(scheduleSpy).toHaveBeenCalledTimes(2);
    expect(isSchedulerRunning()).toBe(true);
  });
});

// ─── Scheduler — alert discovery stub + persisted alert expiry ───────────────

describe('Scheduler — alert task', () => {
  beforeEach(async () => {
    await stopScheduler();
    schedulerTestState.scheduledCallbacks.length = 0;
    vi.mocked(weatherService.runIngestion).mockReset().mockResolvedValue(undefined);
    vi.mocked(weatherService.pollAlerts).mockReset().mockResolvedValue(undefined);
    schedulerTestState.processActiveAlerts.mockReset().mockResolvedValue(undefined);
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await stopScheduler();
  });

  it('calls the pollAlerts no-op before processing persisted alert expiry', async () => {
    initializeScheduler();
    expect(schedulerTestState.scheduledCallbacks).toHaveLength(2);

    const alertTask = schedulerTestState.scheduledCallbacks[1];
    await alertTask();

    expect(weatherService.pollAlerts).toHaveBeenCalledOnce();
    expect(schedulerTestState.processActiveAlerts).toHaveBeenCalledOnce();

    const pollOrder = vi.mocked(weatherService.pollAlerts).mock.invocationCallOrder[0];
    const expiryOrder = schedulerTestState.processActiveAlerts.mock.invocationCallOrder[0];
    expect(expiryOrder).toBeGreaterThan(pollOrder);
  });
});
