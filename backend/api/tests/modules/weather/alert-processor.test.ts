/**
 * Alert Processor Service Tests
 *
 * Tests the AlertProcessorService's ability to mark expired alerts
 * as inactive and retrieve active alerts. All DB interactions are mocked.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AlertProcessorService } from '../../../src/modules/weather/services/alert-processor.service.js';

describe('AlertProcessorService — processActiveAlerts()', () => {
  let service: AlertProcessorService;

  beforeEach(() => {
    service = new AlertProcessorService();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('calls db.update to mark expired alerts as inactive', async () => {
    const { db } = await import('../../../src/database/db.js');

    const mockWhere = vi.fn().mockResolvedValue({ rowsAffected: 2 });
    const mockSet = vi.fn().mockReturnValue({ where: mockWhere });
    const mockUpdate = vi.fn().mockReturnValue({ set: mockSet });
    vi.spyOn(db, 'update').mockImplementation(mockUpdate as any);

    await service.processActiveAlerts();

    expect(mockUpdate).toHaveBeenCalled();
    expect(mockSet).toHaveBeenCalledWith({ isActive: false });
    expect(mockWhere).toHaveBeenCalled();
  });

  it('propagates DB error without silently swallowing it', async () => {
    const { db } = await import('../../../src/database/db.js');

    const mockWhere = vi.fn().mockRejectedValue(new Error('DB connection lost'));
    const mockSet = vi.fn().mockReturnValue({ where: mockWhere });
    vi.spyOn(db, 'update').mockReturnValue({ set: mockSet } as any);

    await expect(service.processActiveAlerts()).rejects.toThrow('DB connection lost');
  });
});

describe('AlertProcessorService — getActiveAlerts()', () => {
  let service: AlertProcessorService;

  beforeEach(() => {
    service = new AlertProcessorService();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns active alerts for a given locationId', async () => {
    const { db } = await import('../../../src/database/db.js');

    const mockAlerts = [
      {
        id: 'alert-1',
        locationId: 'farm-001',
        isActive: true,
        alertType: 'heavy_rain',
        severity: 'high',
        validFrom: new Date(),
        validTo: new Date(Date.now() + 3600_000),
        headline: 'Heavy rain expected',
        description: null,
        recommendedAction: null,
      },
    ];

    vi.spyOn(db, 'select').mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(mockAlerts),
      }),
    } as any);

    const result = await service.getActiveAlerts('farm-001');

    expect(result).toHaveLength(1);
    expect(result[0].locationId).toBe('farm-001');
    expect(result[0].isActive).toBe(true);
  });

  it('returns empty array when no active alerts for the location', async () => {
    const { db } = await import('../../../src/database/db.js');

    vi.spyOn(db, 'select').mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    } as any);

    const result = await service.getActiveAlerts('farm-no-alerts');
    expect(result).toHaveLength(0);
  });

  it('propagates DB error', async () => {
    const { db } = await import('../../../src/database/db.js');

    vi.spyOn(db, 'select').mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockRejectedValue(new Error('Query failed')),
      }),
    } as any);

    await expect(service.getActiveAlerts('farm-001')).rejects.toThrow('Query failed');
  });
});
