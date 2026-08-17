import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { AI_TUTOR_QUEUE, JOB_NAMES } from '../ai-tutor.constants';
import { VideoAnalyticsService } from '../services/video-analytics.service';
import { WeakTopicDetectionService } from '../services/weak-topic-detection.service';
import { RevisionTestService } from '../services/revision-test.service';
import { AttentionSpanService } from '../services/attention-span.service';
import { LearningDnaService } from '../services/learning-dna.service';

@Processor(AI_TUTOR_QUEUE)
export class AiEvaluationProcessor extends WorkerHost {
  private readonly logger = new Logger(AiEvaluationProcessor.name);

  constructor(
    private readonly videoAnalytics: VideoAnalyticsService,
    private readonly weakTopicService: WeakTopicDetectionService,
    private readonly revisionTestService: RevisionTestService,
    private readonly attentionService: AttentionSpanService,
    private readonly learningDnaService: LearningDnaService,
  ) {
    super();
  }

  async process(job: Job): Promise<any> {
    switch (job.name) {
      case JOB_NAMES.RECOMPUTE_TOPIC_MASTERY:
        return this.handleRecomputeMastery(job);
      case JOB_NAMES.EVALUATE_REVISION_TEST:
        return this.handleGeneratePostLectureTest(job);
      case JOB_NAMES.GENERATE_TIMETABLE:
        return this.handleRecomputeAttention(job);
      case JOB_NAMES.RECOMPUTE_LEARNING_DNA:
        return this.handleRecomputeLearningDna(job);
      default:
        this.logger.warn(`Unhandled job type: ${job.name}`);
        return null;
    }
  }

  private async handleRecomputeMastery(job: Job<{ studentId: string; lectureId: string; topicId: string }>) {
    const { studentId, lectureId, topicId } = job.data;
    const summary = await this.videoAnalytics.summarize(studentId, lectureId);
    const signals = this.videoAnalytics.toWeaknessSignals(summary, topicId);
    const results = await this.weakTopicService.applySignals(signals);
    this.logger.log(`Recomputed mastery for student=${studentId} topic=${topicId}: ${results.length} signal(s) applied`);
    return results;
  }

  private async handleGeneratePostLectureTest(job: Job<{ studentId: string; lectureId: string }>) {
    const { studentId, lectureId } = job.data;
    const test = await this.revisionTestService.createForLecture({ studentId, lectureId, triggeredBy: 'POST_LECTURE' });
    this.logger.log(`Generated post-lecture revision test ${test.id} for student=${studentId}`);
    return test;
  }

  private async handleRecomputeAttention(job: Job<{ studentId: string }>) {
    return this.attentionService.recomputeForStudent(job.data.studentId);
  }

  /** Nightly / periodic job: refresh the full Learning DNA profile. */
  private async handleRecomputeLearningDna(job: Job<{ studentId: string }>) {
    return this.learningDnaService.recompute(job.data.studentId);
  }
}
