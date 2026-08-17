import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { VideoEngagementSummary, WeaknessSignal } from '../interfaces/scoring.interface';
import { VIDEO_SIGNAL_WEIGHTS } from '../ai-tutor.constants';

const LONG_PAUSE_THRESHOLD_SEC = 15;
const REGION_MERGE_GAP_SEC = 8;

@Injectable()
export class VideoAnalyticsService {
  private readonly logger = new Logger(VideoAnalyticsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async recordEvent(input: {
    studentId: string;
    lectureId: string;
    eventType:
      | 'PLAY' | 'PAUSE' | 'REWIND' | 'FAST_FORWARD' | 'SKIP_SECTION'
      | 'SPEED_CHANGE' | 'COMPLETE' | 'DROP_OFF';
    atSecond: number;
    toSecond?: number;
    playbackSpeed?: number;
  }) {
    return this.prisma.videoInteractionEvent.create({ data: input });
  }

  async summarize(studentId: string, lectureId: string): Promise<VideoEngagementSummary> {
    const [lecture, events] = await Promise.all([
      this.prisma.lecture.findUniqueOrThrow({ where: { id: lectureId } }),
      this.prisma.videoInteractionEvent.findMany({
        where: { studentId, lectureId },
        orderBy: { createdAt: 'asc' },
      }),
    ]);

    const rewinds = events.filter((e) => e.eventType === 'REWIND');
    const pauses = events.filter((e) => e.eventType === 'PAUSE');
    const skips = events.filter((e) => e.eventType === 'SKIP_SECTION');
    const completedEvent = events.find((e) => e.eventType === 'COMPLETE');
    const dropOffEvent = events.find((e) => e.eventType === 'DROP_OFF');

    const rewindRegions = this.mergeRegions(
      rewinds.map((r) => ({ at: r.toSecond ?? r.atSecond })),
    );
    const skippedRegions = skips
      .filter((s) => s.toSecond != null)
      .map((s) => ({ fromSec: s.atSecond, toSec: s.toSecond as number }));

    let longPauseCount = 0;
    for (let i = 0; i < pauses.length; i++) {
      const pauseTime = pauses[i].createdAt.getTime();
      const nextPlay = events.find(
        (e) =>
          e.eventType === 'PLAY' &&
          e.createdAt.getTime() > pauseTime &&
          Math.abs(e.atSecond - pauses[i].atSecond) < 3,
      );
      if (nextPlay) {
        const gapSec = (nextPlay.createdAt.getTime() - pauseTime) / 1000;
        if (gapSec >= LONG_PAUSE_THRESHOLD_SEC) longPauseCount++;
      }
    }

    const watchedSec = completedEvent
      ? lecture.durationSec
      : (dropOffEvent?.atSecond ?? this.estimateFurthestWatchedPoint(events));

    return {
      lectureId,
      studentId,
      totalDurationSec: lecture.durationSec,
      watchedSec,
      rewindCount: rewinds.length,
      rewindRegions,
      pauseCount: pauses.length,
      longPauseCount,
      skipCount: skips.length,
      skippedRegions,
      completed: !!completedEvent,
      droppedOffAtSec: dropOffEvent?.atSecond ?? null,
    };
  }

  toWeaknessSignals(summary: VideoEngagementSummary, topicId: string): WeaknessSignal[] {
    const signals: WeaknessSignal[] = [];
    const durationMin = Math.max(summary.totalDurationSec / 60, 1);

    const rewindDensity = summary.rewindCount / durationMin;
    const pauseDensity = summary.longPauseCount / durationMin;
    const skipDensity = summary.skipCount / durationMin;

    const confusionScore =
      rewindDensity * VIDEO_SIGNAL_WEIGHTS.rewindDensity +
      pauseDensity * VIDEO_SIGNAL_WEIGHTS.pauseDensity;

    if (confusionScore > 0.1) {
      signals.push({
        source: 'VIDEO',
        topicId,
        studentId: summary.studentId,
        strengthDelta: -Math.min(confusionScore, 1),
        confidence: 0.4,
        occurredAt: new Date(),
        meta: {
          rewindRegions: summary.rewindRegions,
          rewindCount: summary.rewindCount,
          longPauseCount: summary.longPauseCount,
        },
      });
    }

    if (skipDensity > 0.2) {
      signals.push({
        source: 'VIDEO',
        topicId,
        studentId: summary.studentId,
        strengthDelta: summary.completed
          ? Math.min(skipDensity * 0.3, 0.3)
          : VIDEO_SIGNAL_WEIGHTS.skipDensity,
        confidence: 0.25,
        occurredAt: new Date(),
        meta: { skippedRegions: summary.skippedRegions, completed: summary.completed },
      });
    }

    if (!summary.completed && summary.watchedSec < summary.totalDurationSec * 0.6) {
      signals.push({
        source: 'VIDEO',
        topicId,
        studentId: summary.studentId,
        strengthDelta: -VIDEO_SIGNAL_WEIGHTS.dropOffPenalty,
        confidence: 0.5,
        occurredAt: new Date(),
        meta: { droppedOffAtSec: summary.droppedOffAtSec, watchedSec: summary.watchedSec },
      });
    }

    return signals;
  }

  private mergeRegions(points: Array<{ at: number }>) {
    const sorted = [...points].sort((a, b) => a.at - b.at);
    const regions: Array<{ fromSec: number; toSec: number; count: number }> = [];

    for (const p of sorted) {
      const last = regions[regions.length - 1];
      if (last && p.at - last.toSec <= REGION_MERGE_GAP_SEC) {
        last.toSec = p.at;
        last.count += 1;
      } else {
        regions.push({ fromSec: p.at, toSec: p.at, count: 1 });
      }
    }
    return regions;
  }

  private estimateFurthestWatchedPoint(
    events: Array<{ atSecond: number; toSecond: number | null }>,
  ): number {
    return events.reduce((max, e) => Math.max(max, e.atSecond, e.toSecond ?? 0), 0);
  }
}
