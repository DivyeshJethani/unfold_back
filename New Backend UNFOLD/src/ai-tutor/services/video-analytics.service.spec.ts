import { Test } from '@nestjs/testing';
import { VideoAnalyticsService } from './video-analytics.service';
import { PrismaService } from '../../prisma/prisma.service';
import { VideoEngagementSummary } from '../interfaces/scoring.interface';

describe('VideoAnalyticsService.toWeaknessSignals', () => {
  let service: VideoAnalyticsService;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [VideoAnalyticsService, { provide: PrismaService, useValue: {} }],
    }).compile();
    service = moduleRef.get(VideoAnalyticsService);
  });

  const baseSummary: VideoEngagementSummary = {
    lectureId: 'l1', studentId: 's1', totalDurationSec: 600, watchedSec: 600,
    rewindCount: 0, rewindRegions: [], pauseCount: 0, longPauseCount: 0,
    skipCount: 0, skippedRegions: [], completed: true, droppedOffAtSec: null,
  };

  it('produces no weakness signal for clean, uninterrupted viewing', () => {
    expect(service.toWeaknessSignals(baseSummary, 't1').length).toBe(0);
  });

  it('produces a negative confusion signal for heavy rewinding + long pauses', () => {
    const summary = { ...baseSummary, rewindCount: 8, longPauseCount: 4 };
    const confusion = service.toWeaknessSignals(summary, 't1').find((s) => s.strengthDelta < 0);
    expect(confusion).toBeDefined();
  });

  it('produces a positive signal for confident skipping when the lecture was completed', () => {
    const summary = { ...baseSummary, skipCount: 5, completed: true };
    const skipSignal = service.toWeaknessSignals(summary, 't1').find((s) => s.meta && 'skippedRegions' in (s.meta as object));
    expect(skipSignal?.strengthDelta).toBeGreaterThan(0);
  });

  it('produces a negative signal for skipping combined with not finishing (disengagement)', () => {
    const summary = { ...baseSummary, skipCount: 5, completed: false, watchedSec: 200 };
    const skipSignal = service.toWeaknessSignals(summary, 't1').find((s) => s.meta && 'skippedRegions' in (s.meta as object));
    expect(skipSignal?.strengthDelta).toBeLessThan(0);
  });

  it('flags a drop-off penalty when the student left before 60% completion', () => {
    const summary = { ...baseSummary, completed: false, watchedSec: 150, droppedOffAtSec: 150 };
    const dropOff = service.toWeaknessSignals(summary, 't1').find((s) => s.meta && 'droppedOffAtSec' in (s.meta as object));
    expect(dropOff).toBeDefined();
    expect(dropOff!.strengthDelta).toBeLessThan(0);
  });
});
