import cron, { ScheduledTask } from 'node-cron';
import { weatherService } from '../modules/weather/services/weather.service.js';
import { AlertProcessorService } from '../modules/weather/services/alert-processor.service.js';

const alertProcessorService = new AlertProcessorService();

let isInitialized = false;
let inFlightTasks = 0;
const activeTasks: ScheduledTask[] = [];

/**
 * Initializes background cron jobs for Pillar 3 weather ingestion and alert polling.
 * Protected against duplicate registration.
 */
export function initializeScheduler(): boolean {
  if (isInitialized) {
    console.log('[Scheduler] Already initialized, skipping duplicate initialization.');
    return false;
  }

  // Fetch weather data daily at 6:00 AM
  const ingestionTask = cron.schedule('0 6 * * *', async () => {
    if (!isInitialized) return;
    inFlightTasks++;
    console.log('[Scheduler] Running daily weather ingestion...');
    try {
      await weatherService.runIngestion();
      console.log('[Scheduler] Weather ingestion completed.');
    } catch (error) {
      console.error('[Scheduler] Weather ingestion failed:', error);
    } finally {
      inFlightTasks = Math.max(0, inFlightTasks - 1);
    }
  });
  activeTasks.push(ingestionTask);

  // Poll alerts every 15 minutes (expires stale persisted alerts; discovery stub)
  const alertTask = cron.schedule('*/15 * * * *', async () => {
    if (!isInitialized) return;
    inFlightTasks++;
    console.log('[Scheduler] Running alert expiry processing (pollAlerts is a no-op stub)...');
    try {
      await weatherService.pollAlerts();         // no-op stub until provider configured
      await alertProcessorService.processActiveAlerts();
      console.log('[Scheduler] Alert expiry processing completed.');
    } catch (error) {
      console.error('[Scheduler] Alert processing failed:', error);
    } finally {
      inFlightTasks = Math.max(0, inFlightTasks - 1);
    }
  });
  activeTasks.push(alertTask);

  isInitialized = true;
  console.log('[Scheduler] Initialized Pillar 3 scheduled tasks successfully.');
  return true;
}

/**
 * Stops all active scheduler tasks and resets initialization state.
 * Safe to call during server shutdown or test teardown.
 */
export async function stopScheduler(timeoutMs: number = 3000): Promise<void> {
  isInitialized = false;
  for (const task of activeTasks) {
    try {
      task.stop();
    } catch (err) {
      console.error('[Scheduler] Error stopping scheduled task:', err);
    }
  }
  activeTasks.length = 0;

  // Gracefully wait for any in-flight task to finish up to timeoutMs.
  // Do NOT reset inFlightTasks to 0 here: each task's finally block decrements
  // the counter itself. Resetting here would corrupt the count if tasks are
  // still running past the timeout.
  const start = Date.now();
  while (inFlightTasks > 0 && Date.now() - start < timeoutMs) {
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  if (inFlightTasks > 0) {
    console.warn(
      `[Scheduler] Shutdown timed out after ${timeoutMs}ms with ${inFlightTasks} task(s) still in flight.`
    );
  }
  console.log('[Scheduler] Stopped all active scheduled tasks.');
}

/**
 * Returns current scheduler status.
 */
export function isSchedulerRunning(): boolean {
  return isInitialized;
}

/**
 * Returns count of in-flight tasks.
 */
export function getInFlightTaskCount(): number {
  return inFlightTasks;
}
