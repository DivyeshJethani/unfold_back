import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding Cognify database...');

  // 1. Demo User & Student
  // Standard bcrypt hash for: Password123!
  const demoPasswordHash = '$2b$10$Vb2t6w4476FmR.zYx0v6qu2B7Zp2Kz/j6QhM712wVl87fJ9mHw8tW';

  const user = await prisma.user.upsert({
    where: { email: 'student@cognify.edu' },
    update: {},
    create: {
      id: 'u-demo-student-01',
      email: 'student@cognify.edu',
      password: demoPasswordHash,
      name: 'Aarav Sharma',
      role: 'STUDENT',
    },
  });

  const student = await prisma.student.upsert({
    where: { userId: user.id },
    update: {},
    create: {
      id: 's-demo-student-01',
      userId: user.id,
      standardId: '10',
      boardId: 'CBSE',
      streamId: 'SCIENCE',
    },
  });

  // 2. Student Wallet & Attention Profile
  await prisma.creditWallet.upsert({
    where: { studentId: student.id },
    update: {},
    create: {
      studentId: student.id,
      balance: 50,
      lifetimeEarned: 50,
    },
  });

  await prisma.attentionProfile.upsert({
    where: { studentId: student.id },
    update: {},
    create: {
      studentId: student.id,
      estimatedAttentionSpanSec: 900,
      memoryRetentionScore: 0.75,
      bestFocusWindowStart: 16,
      bestFocusWindowEnd: 19,
    },
  });

  // 3. Subject: Physics
  const subject = await prisma.subject.upsert({
    where: { code: 'PHY101' },
    update: { name: 'Physics' },
    create: {
      id: 'sub-physics-01',
      name: 'Physics',
      code: 'PHY101',
    },
  });

  // 4. Topics: Kinematics & Newton's Laws
  const topic1 = await prisma.topic.upsert({
    where: { id: 'top-kinematics-01' },
    update: {
      name: 'Kinematics & 1D Motion',
      subjectId: subject.id,
      order: 1,
      difficultyBaseline: 0.5,
    },
    create: {
      id: 'top-kinematics-01',
      subjectId: subject.id,
      name: 'Kinematics & 1D Motion',
      order: 1,
      difficultyBaseline: 0.5,
    },
  });

  const topic2 = await prisma.topic.upsert({
    where: { id: 'top-newtons-laws-02' },
    update: {
      name: "Newton's Laws of Motion",
      subjectId: subject.id,
      order: 2,
      prerequisiteTopicId: topic1.id,
      difficultyBaseline: 0.6,
    },
    create: {
      id: 'top-newtons-laws-02',
      subjectId: subject.id,
      name: "Newton's Laws of Motion",
      order: 2,
      prerequisiteTopicId: topic1.id,
      difficultyBaseline: 0.6,
    },
  });

  // 5. Lecture for Kinematics
  await prisma.lecture.upsert({
    where: { id: 'lec-kinematics-intro' },
    update: {
      title: 'Introduction to Velocity and Acceleration',
      topicId: topic1.id,
      videoUrl: 'https://storage.googleapis.com/cognify-demo-media/kinematics-intro.mp4',
      durationSec: 720,
    },
    create: {
      id: 'lec-kinematics-intro',
      topicId: topic1.id,
      title: 'Introduction to Velocity and Acceleration',
      videoUrl: 'https://storage.googleapis.com/cognify-demo-media/kinematics-intro.mp4',
      durationSec: 720,
    },
  });

  // 6. Topic Mastery initial baseline
  await prisma.topicMastery.upsert({
    where: {
      studentId_topicId: {
        studentId: student.id,
        topicId: topic1.id,
      },
    },
    update: {},
    create: {
      studentId: student.id,
      topicId: topic1.id,
      masteryScore: 0.5,
      masteryLevel: 'DEVELOPING',
      confidence: 0.3,
      needsReview: false,
    },
  });

  // 7. Deterministic Quiz Questions for Kinematics
  const questions = [
    {
      id: 'q-kinematics-01',
      topicId: topic1.id,
      prompt: 'A car accelerates uniformly from rest to a speed of 20 m/s in 5 seconds. What is its acceleration?',
      options: [
        { id: 'opt-a', text: '2 m/s²' },
        { id: 'opt-b', text: '4 m/s²' },
        { id: 'opt-c', text: '5 m/s²' },
        { id: 'opt-d', text: '100 m/s²' },
      ],
      correctOptionId: 'opt-b',
      difficulty: 0.4,
    },
    {
      id: 'q-kinematics-02',
      topicId: topic1.id,
      prompt: 'If an object is thrown vertically upwards, what is its velocity at the highest point of its trajectory?',
      options: [
        { id: 'opt-a', text: '9.8 m/s' },
        { id: 'opt-b', text: 'Depends on initial velocity' },
        { id: 'opt-c', text: '0 m/s' },
        { id: 'opt-d', text: '-9.8 m/s' },
      ],
      correctOptionId: 'opt-c',
      difficulty: 0.3,
    },
    {
      id: 'q-kinematics-03',
      topicId: topic1.id,
      prompt: 'What does the area under a velocity-time graph represent?',
      options: [
        { id: 'opt-a', text: 'Acceleration' },
        { id: 'opt-b', text: 'Displacement' },
        { id: 'opt-c', text: 'Speed' },
        { id: 'opt-d', text: 'Total force' },
      ],
      correctOptionId: 'opt-b',
      difficulty: 0.5,
    },
  ];

  for (const q of questions) {
    await prisma.quizQuestion.upsert({
      where: { id: q.id },
      update: {
        prompt: q.prompt,
        options: q.options,
        correctOptionId: q.correctOptionId,
        difficulty: q.difficulty,
      },
      create: {
        id: q.id,
        topicId: q.topicId,
        prompt: q.prompt,
        options: q.options,
        correctOptionId: q.correctOptionId,
        difficulty: q.difficulty,
      },
    });
  }

  console.log('Seed finished successfully.');
}

main()
  .catch((e) => {
    console.error('Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
