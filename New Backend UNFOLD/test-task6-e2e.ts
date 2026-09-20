import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from './src/app.module';
import { INestApplication } from '@nestjs/common';
import { PrismaService } from './src/prisma/prisma.service';
import { AuthService } from './src/auth/auth.service';
import { LearningDnaController } from './src/ai-tutor/controllers/learning-dna.controller';
import { AssessmentController } from './src/ai-tutor/controllers/assessment.controller';

async function runTask6Verification() {
  console.log('=== STARTING REAL POSTGRESQL & API VERIFICATION FOR TASK 6 ===\n');

  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app: INestApplication = moduleFixture.createNestApplication();
  await app.init();

  const prisma = app.get(PrismaService);
  const authService = app.get(AuthService);
  const dnaController = app.get(LearningDnaController);
  const assessmentController = app.get(AssessmentController);

  try {
    // 0. Setup: Clean up any previous test students if exist
    const testEmailA = `task6_student_a_${Date.now()}@example.com`;
    const testEmailB = `task6_student_b_${Date.now()}@example.com`;

    console.log(`[Step 0] Registering test students:`);
    console.log(`  Student A: ${testEmailA}`);
    console.log(`  Student B: ${testEmailB}`);

    const authA = await authService.register({
      email: testEmailA,
      password: 'DevPassword123!',
      name: 'Task6 Student A',
    });
    const authB = await authService.register({
      email: testEmailB,
      password: 'DevPassword123!',
      name: 'Task6 Student B',
    });

    const studentAId = authA.student.id;
    const studentBId = authB.student.id;
    console.log(`  Student A ID: ${studentAId}`);
    console.log(`  Student B ID: ${studentBId}`);

    // Fetch a topic or create a test quiz question if none exist
    let topic = await prisma.topic.findFirst({
      include: { quizQuestions: true },
    });
    if (!topic) {
      throw new Error('No topics found. Please run seed first.');
    }
    let question1 = topic.quizQuestions[0];
    if (!question1) {
      question1 = await prisma.quizQuestion.create({
        data: {
          topicId: topic.id,
          prompt: 'What is the discriminant of ax^2 + bx + c = 0?',
          options: [
            { id: 'opt-1', text: 'b^2 - 4ac' },
            { id: 'opt-2', text: 'b^2 + 4ac' },
          ],
          correctOptionId: 'opt-1',
          difficulty: 0.5,
        },
      });
      console.log(`  Created test QuizQuestion: ${question1.id}`);
    }
    console.log(`  Using Seeded Topic: "${topic.name}" (${topic.id}) with question ${question1.id}\n`);

    // ------------------------------------------------------------------------
    // VERIFICATION 1: Authenticated student starts with known history state (0)
    // ------------------------------------------------------------------------
    console.log('------------------------------------------------------------');
    console.log('[Check 1] Authenticated Student A starts with 0 history records:');
    const initialHistoryA = await dnaController.history(studentAId, topic.id);
    console.log(`  GET /learning-dna/history returned ${initialHistoryA.length} records.`);
    if (initialHistoryA.length !== 0) {
      throw new Error(`Expected 0 history records, found ${initialHistoryA.length}`);
    }
    console.log('  -> PASS: Initial history is empty as expected.\n');

    // ------------------------------------------------------------------------
    // VERIFICATION 2: Genuine quiz evaluation creates history record
    // ------------------------------------------------------------------------
    console.log('------------------------------------------------------------');
    console.log('[Check 2] Genuine quiz evaluation creates first TopicMasteryHistory record:');
    const attempt1 = await assessmentController.submit(studentAId, {
      topicId: topic.id,
      answers: [
        {
          questionId: question1.id,
          selectedOptionId: question1.correctOptionId,
          timeTakenMs: 15000,
          predictedConfidence: 0.85,
        },
      ],
    });
    console.log(`  Submitted Quiz Attempt 1 (Score: ${attempt1.score})`);

    const historyAfterEval1 = await dnaController.history(studentAId, topic.id);
    console.log(`  GET /learning-dna/history now returned ${historyAfterEval1.length} records.`);
    if (historyAfterEval1.length !== 1) {
      throw new Error(`Expected 1 history record, found ${historyAfterEval1.length}`);
    }
    const snap1 = historyAfterEval1[0];
    console.log(`  Snapshot 1 in PostgreSQL: id=${snap1.id}, score=${snap1.masteryScore}, level=${snap1.masteryLevel}, recordedAt=${snap1.recordedAt.toISOString()}`);
    console.log('  -> PASS: Genuine evaluation created exactly 1 history record.\n');

    // Wait a brief moment to ensure distinct chronological timestamps
    await new Promise((r) => setTimeout(r, 100));

    // ------------------------------------------------------------------------
    // VERIFICATION 3 & 4: Second genuine evaluation creates chronological history
    // ------------------------------------------------------------------------
    console.log('------------------------------------------------------------');
    console.log('[Check 3 & 4] Second genuine evaluation creates another history record chronologically:');
    const attempt2 = await assessmentController.submit(studentAId, {
      topicId: topic.id,
      answers: [
        {
          questionId: question1.id,
          selectedOptionId: question1.correctOptionId,
          timeTakenMs: 12000,
          predictedConfidence: 0.95,
        },
      ],
    });
    console.log(`  Submitted Quiz Attempt 2 (Score: ${attempt2.score})`);

    const historyAfterEval2 = await dnaController.history(studentAId, topic.id);
    console.log(`  GET /learning-dna/history now returned ${historyAfterEval2.length} records.`);
    if (historyAfterEval2.length !== 2) {
      throw new Error(`Expected 2 history records, found ${historyAfterEval2.length}`);
    }
    const snap2 = historyAfterEval2[1];
    console.log(`  Snapshot 2 in PostgreSQL: id=${snap2.id}, score=${snap2.masteryScore}, level=${snap2.masteryLevel}, recordedAt=${snap2.recordedAt.toISOString()}`);

    const isChronological = new Date(snap1.recordedAt).getTime() <= new Date(snap2.recordedAt).getTime();
    console.log(`  Chronological check: snap1 <= snap2 is ${isChronological}`);
    if (!isChronological) {
      throw new Error('Snapshots are not in chronological order!');
    }
    console.log('  -> PASS: Second evaluation created second record in chronological order.\n');

    // ------------------------------------------------------------------------
    // VERIFICATION 5: GET /learning-dna/profile does NOT create history record
    // ------------------------------------------------------------------------
    console.log('------------------------------------------------------------');
    console.log('[Check 5] GET /learning-dna/profile does NOT create history records:');
    const profile = await dnaController.profile(studentAId);
    console.log(`  Profile recomputed: learningSpeed=${profile.learningSpeed}, memoryRetention=${profile.memoryRetention}`);
    console.log(`  Profile longitudinal trajectory=${profile.longitudinal?.masteryTrajectory}`);

    const historyAfterProfile = await dnaController.history(studentAId, topic.id);
    console.log(`  GET /learning-dna/history count after profile read: ${historyAfterProfile.length}`);
    if (historyAfterProfile.length !== 2) {
      throw new Error(`Expected history count to remain 2, but found ${historyAfterProfile.length}`);
    }
    console.log('  -> PASS: Read/recompute did NOT create any additional history records.\n');

    // ------------------------------------------------------------------------
    // VERIFICATION 6: GET /learning-dna/trajectory reflects historical change
    // ------------------------------------------------------------------------
    console.log('------------------------------------------------------------');
    console.log('[Check 6] GET /learning-dna/trajectory reflects historical change:');
    const trajectory = await dnaController.trajectory(studentAId);
    console.log(`  Trajectory result:`);
    console.log(`    masteryTrajectory: ${trajectory.masteryTrajectory}`);
    console.log(`    totalSnapshots: ${trajectory.totalSnapshots}`);
    console.log(`    improvingTopics: ${trajectory.improvingTopics.length}`);
    if (trajectory.improvingTopics.length > 0) {
      const imp = trajectory.improvingTopics[0];
      console.log(`    Improving Topic: "${imp.topicName}" (score: ${imp.previousScore} -> ${imp.currentScore}, delta: +${imp.delta}, trend: ${imp.trend})`);
    }
    if (trajectory.masteryTrajectory !== 'IMPROVING') {
      throw new Error(`Expected masteryTrajectory to be 'IMPROVING', got ${trajectory.masteryTrajectory}`);
    }
    console.log('  -> PASS: Trajectory correctly reflects improving historical mastery.\n');

    // ------------------------------------------------------------------------
    // VERIFICATION 7: Student isolation
    // ------------------------------------------------------------------------
    console.log('------------------------------------------------------------');
    console.log('[Check 7] Student isolation: Student B cannot see Student A\'s history:');
    const historyStudentB = await dnaController.history(studentBId, topic.id);
    console.log(`  GET /learning-dna/history for Student B returned ${historyStudentB.length} records.`);
    if (historyStudentB.length !== 0) {
      throw new Error(`Student B should have 0 history records, but got ${historyStudentB.length}`);
    }
    const trajectoryStudentB = await dnaController.trajectory(studentBId);
    console.log(`  GET /learning-dna/trajectory for Student B: trajectory=${trajectoryStudentB.masteryTrajectory}, totalSnapshots=${trajectoryStudentB.totalSnapshots}`);
    if (trajectoryStudentB.masteryTrajectory !== 'INSUFFICIENT_DATA' || trajectoryStudentB.totalSnapshots !== 0) {
      throw new Error('Student B should have INSUFFICIENT_DATA and 0 snapshots');
    }
    console.log('  -> PASS: Student isolation fully enforced across history and trajectory.\n');

    // ------------------------------------------------------------------------
    // DIRECT POSTGRESQL CHECK
    // ------------------------------------------------------------------------
    console.log('------------------------------------------------------------');
    console.log('[Database Check] Querying PostgreSQL directly via Prisma:');
    const pgRows = await prisma.topicMasteryHistory.findMany({
      where: { studentId: studentAId },
      orderBy: { recordedAt: 'asc' },
    });
    console.log(`  Direct PostgreSQL query returned ${pgRows.length} rows in TopicMasteryHistory for Student A.`);
    for (const r of pgRows) {
      console.log(`    - ID: ${r.id}, Score: ${r.masteryScore}, Level: ${r.masteryLevel}, RecordedAt: ${r.recordedAt}`);
    }
    console.log('  -> PASS: Real PostgreSQL table TopicMasteryHistory verified with live data.\n');

    console.log('============================================================');
    console.log('ALL REAL POSTGRESQL & API VERIFICATIONS PASSED SUCCESSFULLY!');
    console.log('============================================================');
  } finally {
    await app.close();
  }
}

runTask6Verification().catch((err) => {
  console.error('VERIFICATION FAILED:', err);
  process.exit(1);
});
