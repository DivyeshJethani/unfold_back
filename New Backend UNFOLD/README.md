# AI Tutor Backend — Learning DNA Edition

This extends the original AI-tutor logic module with the deeper personalization
ideas from the platform vision doc: *why* a student got something wrong (not
just that they did), which teaching format actually works for them, how they
react when stuck, whether they truly remember something weeks later, how well
they know what they know, and one combined profile — "Learning DNA" — that
ties it all together.

Nothing from the original module was removed; everything below is additive.

## New pieces, and the reasoning behind each

### Mistake-type classification (`mistake-classification.service.ts`)
"60% and 60%" from two students can mean completely different things. Every
wrong answer is classified as `CONCEPT` / `CALCULATION` / `MEMORY` / `LOGIC` /
`CARELESS` using cheap heuristics first (answer time, presence/shape of
working text) and only escalating to Nemotron when the heuristic is genuinely
ambiguous — this keeps grading fast for the common cases (MCQ guesses, blank
workings) and reserves the paid LLM call for when it adds real signal. A
per-topic "dominant mistake pattern" is maintained via majority vote over the
last 20 wrong answers.

### Confidence calibration (`confidence-calibration.service.ts`)
Captures "how sure are you?" alongside answers and scores it with a **Brier
score** — the standard measure of whether stated confidence matches actual
accuracy. Reports a bias direction (`OVERCONFIDENT` / `UNDERCONFIDENT` /
`WELL_CALIBRATED`), and rewards well-calibrated *uncertainty* exactly as much
as well-calibrated confidence — a student who says "20% sure" and is wrong is
just as informative as one who says "95% sure" and is right.

### Multi-format teaching test (`teaching-format.service.ts`)
Instead of asking "are you a visual learner?", the same concept is actually
served through different formats (text/video/diagram/example/simulation) and
the results are compared. Implemented as a small **multi-armed bandit**:
untried formats get priority (cold-start coverage), a tunable epsilon
(`FORMAT_EXPLORATION_EPSILON`, currently 0.2) keeps re-testing formats that
aren't currently "best" so a lucky first result doesn't lock in forever, and
recommendations only trust a format's average once it has enough attempts
(`FORMAT_MIN_ATTEMPTS_FOR_CONFIDENCE`).

### Reaction to difficulty (`struggle-behavior.service.ts`)
Logs what a student actually does when stuck — persisted to a correct answer,
switched approach, retried, used a hint, viewed the solution, or gave up —
each weighted toward a resilience score. The point (straight from the doc):
**weak-topic + high-resilience** and **weak-topic + low-resilience** look
identical if you only track mastery, but need completely different responses
— one needs time, the other needs confidence-building before more content.

### Spaced retention checkpoints (`spaced-retention.service.ts`)
The doc's "test today, then 2 days, 7 days, 30 days later" idea. Scheduled
the moment a student first reaches PROFICIENT+ on a topic; resolving a check
feeds a `SPACED_RETENTION` signal into mastery, weighted by interval — a
30-day forgetting result is trusted more than a 2-day one. Produces a real
forgetting-curve shape per topic (`getForgettingCurve`), a proper upgrade
from the original module's two-point retention approximation.

### Full assessment orchestration (`assessment.service.ts`)
The endpoint that actually wires mistake classification + confidence
calibration + mastery scoring + credits into one quiz submission, rather
than leaving them as disconnected services nothing calls.

### Stretch goals (`stretch-goal.service.ts`)
"You've reached your goal — want to aim higher?" Compares current average
mastery against the student's stated goal; if they're meaningfully ahead
(`STRETCH_GOAL_TRIGGER_MARGIN_PERCENT`), offers — never forces — a higher
target. Explicitly a snapshot comparison, not a trend projection (see honest
gaps below).

### Learning DNA (`learning-dna.service.ts`)
The single aggregation point. Pulls attention/retention, calibration,
resilience, preferred format, and mistake patterns into one profile, stores
it (`LearningDnaProfile`), and generates a plain-English summary paragraph
("This student learns quickly and holds onto what they learn well. Focus
holds for roughly 18 minutes at a time...") — meant to be genuinely readable
by a parent or teacher, not just a data dump.

## Honest gaps (documented, not hidden)

- **`learningSpeed` and the stretch-goal projection are both snapshot
  proxies, not true trend measurements.** A real "how fast does this student
  learn" or "where is their trajectory headed" needs a time-series of
  mastery scores, not just the current value — `TopicMastery` is a single
  current row per topic today. Both services say so directly in their code
  comments, and both are written so that adding a history table later is a
  one-function change, not a rearchitecture.
- **The "explain to a younger student" framing from the doc** reuses the
  existing AI-teachback flow (`peer-teaching.service.ts`) rather than being
  a separate service — the evaluation mechanism is identical, only the
  prompt framing would differ, so it didn't warrant new infrastructure.
- **Novel-context "transfer of understanding" tests** (give a new
  real-world scenario, see if the concept transfers) aren't built as a
  separate service yet — the cleanest home for this is a `RevisionTest`
  variant with a `TRANSFER` trigger type, which is a small, well-scoped
  next addition rather than something built speculatively now.
- Auth is still a stub (`CurrentStudentId` decorator) pending the
  backend-core phase, same as before.

## Verified in this environment

`npm install && npx tsc --noEmit && npx jest`:
- **Clean type-check** across the entire project (two real wiring bugs were
  found and fixed this pass — a duplicate route/body `lectureId` and an
  implicit `never[]` array — both are the kind of thing that only surfaces
  under a real compiler run, not by reading the code).
- **48/48 tests passing** across 8 suites, covering: EWMA mastery math
  (original + new spaced-retention signal), the mistake-type heuristic
  classifier and its Nemotron escalation/fallback path, Brier-score
  calibration and bias detection, the format-recommendation bandit
  (cold-start, exploitation, low-trust filtering), resilience scoring
  (including the "same mastery, different resilience" distinction the doc
  calls out), stretch-goal thresholding, and the credit wallet.

## Running locally

```bash
cp .env.example .env
docker compose up -d postgres redis
npx prisma generate    # schema now lives at prisma/schema.prisma (standard location)
npx prisma migrate dev --name init
npm run start:dev
# Swagger UI: http://localhost:3000/api/docs
```
