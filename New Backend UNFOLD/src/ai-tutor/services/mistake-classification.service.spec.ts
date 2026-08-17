import { Test } from '@nestjs/testing';
import { MistakeClassificationService } from './mistake-classification.service';
import { PrismaService } from '../../prisma/prisma.service';
import { NemotronService } from './nemotron.service';

describe('MistakeClassificationService.classifyHeuristically', () => {
  let service: MistakeClassificationService;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        MistakeClassificationService,
        { provide: PrismaService, useValue: {} },
        { provide: NemotronService, useValue: { evaluateExplanation: jest.fn() } },
      ],
    }).compile();
    service = moduleRef.get(MistakeClassificationService);
  });

  it('returns NONE for a correct answer regardless of other inputs', () => {
    const result = service.classifyHeuristically({ isCorrect: true, timeTakenMs: 500, workingText: '' });
    expect(result.mistakeType).toBe('NONE');
    expect(result.confidence).toBe(1);
  });

  it('classifies a fast, blank-working wrong answer as CARELESS (a guess)', () => {
    const result = service.classifyHeuristically({ isCorrect: false, timeTakenMs: 1500, workingText: '' });
    expect(result.mistakeType).toBe('CARELESS');
  });

  it('classifies a slow, blank-working wrong answer as CONCEPT (no method produced)', () => {
    const result = service.classifyHeuristically({ isCorrect: false, timeTakenMs: 45000, workingText: '' });
    expect(result.mistakeType).toBe('CONCEPT');
  });

  it('classifies working that references a formula as MEMORY', () => {
    const result = service.classifyHeuristically({
      isCorrect: false, timeTakenMs: 20000, workingText: 'used the formula x = -b/2a but got the wrong sign',
    });
    expect(result.mistakeType).toBe('MEMORY');
  });

  it('classifies numeric-heavy working (correct method, wrong arithmetic) as CALCULATION', () => {
    const result = service.classifyHeuristically({
      isCorrect: false, timeTakenMs: 30000, workingText: '12 34 56 78 90 11 22 33 44 55 66 77 12 34',
    });
    expect(result.mistakeType).toBe('CALCULATION');
  });

  it('falls back to LOGIC with low confidence when nothing else matches', () => {
    const result = service.classifyHeuristically({
      isCorrect: false, timeTakenMs: 20000, workingText: 'I thought the shape changes because of the angle somehow',
    });
    expect(result.mistakeType).toBe('LOGIC');
    expect(result.confidence).toBeLessThan(0.4);
  });
});

describe('MistakeClassificationService.classify (escalation to Nemotron)', () => {
  let service: MistakeClassificationService;
  let nemotron: { evaluateExplanation: jest.Mock };

  beforeEach(async () => {
    nemotron = { evaluateExplanation: jest.fn() };
    const moduleRef = await Test.createTestingModule({
      providers: [
        MistakeClassificationService,
        { provide: PrismaService, useValue: {} },
        { provide: NemotronService, useValue: nemotron },
      ],
    }).compile();
    service = moduleRef.get(MistakeClassificationService);
  });

  it('does NOT escalate to Nemotron when the heuristic is already confident', async () => {
    const result = await service.classify({
      topicName: 'Quadratics', isCorrect: false, timeTakenMs: 1000, workingText: '',
    });
    expect(nemotron.evaluateExplanation).not.toHaveBeenCalled();
    expect(result.mistakeType).toBe('CARELESS');
  });

  it('escalates to Nemotron for a long, ambiguous explanation and uses its verdict', async () => {
    nemotron.evaluateExplanation.mockResolvedValue({
      qualityScore: 0.6,
      feedbackForStudent: 'LOGIC the student picked the wrong overall approach for this problem type',
    });
    const result = await service.classify({
      topicName: 'Quadratics',
      isCorrect: false,
      timeTakenMs: 25000,
      workingText: 'I tried a totally different approach that seemed reasonable but did not work out in the end',
    });
    expect(nemotron.evaluateExplanation).toHaveBeenCalled();
    expect(result.mistakeType).toBe('LOGIC');
  });

  it('falls back to the heuristic result if the Nemotron call throws', async () => {
    nemotron.evaluateExplanation.mockRejectedValue(new Error('network error'));
    const result = await service.classify({
      topicName: 'Quadratics',
      isCorrect: false,
      timeTakenMs: 25000,
      workingText: 'I tried a totally different approach that seemed reasonable but did not work out in the end',
    });
    expect(result.mistakeType).toBe('LOGIC'); // heuristic fallback, not a thrown error
  });
});
