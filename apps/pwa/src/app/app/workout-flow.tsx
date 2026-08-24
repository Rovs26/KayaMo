'use client';

import {
  bestE1rmFromSets,
  calculatePlatesPerSide,
  COMPANION_EVENT_POINTS,
  proposeFromSessions,
  scaleWorkoutSetCount,
  selectWorkoutExercises,
  sessionVolumeKg,
  WORKOUT_VERSION_LABELS,
  type ExerciseSessionPerformance,
  type WorkoutVersion,
} from '@kayamo/core';
import {
  clearLocalRestTimer,
  completeLocalWorkoutSet,
  extendLocalRestTimer,
  finishLocalWorkout,
  getLocalRestTimer,
  listLocalWorkoutHistory,
  listLocalWorkoutSets,
  startLocalRestTimer,
  startLocalWorkout,
  type LocalWorkout,
  type LocalWorkoutSet,
} from '@kayamo/offline';
import {
  ArrowBendDownLeft,
  ArrowLeft,
  Barbell,
  CheckCircle,
  Circle,
  Plus,
  Timer,
  Tree,
  X,
} from '@phosphor-icons/react';
import Image from 'next/image';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import styles from './kayamo-app.module.css';

const REST_SECONDS = 90;

type DraftSet = {
  key: string;
  weightKg: number;
  reps: number;
  lastLabel: string;
  confirmedId: string | null;
};

type DraftExercise = {
  exerciseId: string;
  name: string;
  suggestLabel: string;
  ormLabel: string;
  lastWas: string;
  planLabel: string;
  deload: boolean;
  note: string;
  sets: DraftSet[];
};

type SetSheet = { exerciseIndex: number; setIndex: number; weightKg: number; reps: number };
type WorkoutPhase = 'proposed' | 'active' | 'done';

function newKey() {
  return crypto.randomUUID();
}

function clock(seconds: number) {
  const safe = Math.max(0, seconds);
  return `${String(Math.floor(safe / 60)).padStart(2, '0')}:${String(safe % 60).padStart(2, '0')}`;
}

function groupSets(rows: LocalWorkoutSet[]) {
  const map = new Map<string, LocalWorkoutSet[]>();
  for (const row of rows) {
    const list = map.get(row.exercise_id) ?? [];
    list.push(row);
    map.set(row.exercise_id, list);
  }
  return [...map.entries()].map(([exerciseId, sets]) => ({
    exerciseId,
    name: sets[0]?.exercise_name_snapshot ?? 'Exercise',
    order: sets[0]?.exercise_order ?? 0,
    sets: sets.sort((a, b) => a.set_index - b.set_index),
  }));
}

async function buildProposal(userId: string, version: WorkoutVersion): Promise<{
  title: string;
  deload: boolean;
  version: WorkoutVersion;
  exercises: DraftExercise[];
}> {
  const history = (await listLocalWorkoutHistory(userId)).filter((row) => row.status === 'completed');
  const recent = history.slice(0, 8);
  const byExercise = new Map<string, { name: string; sessions: ExerciseSessionPerformance[] }>();
  for (const workout of recent) {
    const sets = await listLocalWorkoutSets(workout.id);
    const grouped = groupSets(sets);
    for (const group of grouped) {
      const existing = byExercise.get(group.exerciseId) ?? {
        name: group.name,
        sessions: [],
      };
      existing.sessions.push({
        sessionId: workout.id,
        sessionDate: workout.logical_date,
        sets: group.sets.map((set) => ({
          id: set.id,
          sessionId: workout.id,
          sessionDate: workout.logical_date,
          weightKg: Number(set.weight_kg),
          reps: set.reps,
          isWarmup: set.is_warmup,
        })),
      });
      byExercise.set(group.exerciseId, existing);
    }
  }

  const last = recent[0];
  const lastSets = last ? await listLocalWorkoutSets(last.id) : [];
  const lastOrder = groupSets(lastSets);
  const exerciseIds = lastOrder.length > 0 ? lastOrder.map((row) => row.exerciseId) : [...byExercise.keys()];
  const exercises: DraftExercise[] = [];
  let deload = false;
  for (const exerciseId of exerciseIds) {
    const record = byExercise.get(exerciseId);
    if (!record) continue;
    const plan = proposeFromSessions({ sessions: record.sessions });
    if (plan.deload) deload = true;
    const latest = [...record.sessions].sort((a, b) => a.sessionDate.localeCompare(b.sessionDate)).at(-1);
    const lastWorking = (latest?.sets ?? []).filter((set) => !set.isWarmup);
    exercises.push({
      exerciseId,
      name: record.name,
      suggestLabel: plan.suggestLabel,
      ormLabel: plan.ormLabel,
      lastWas: plan.wasLabel,
      planLabel: plan.planLabel,
      deload: plan.deload,
      note: '',
      sets: Array.from({ length: plan.setCount }, (_, index) => ({
        key: newKey(),
        weightKg: plan.weightKg,
        reps: plan.reps,
        lastLabel:
          lastWorking[index]
            ? `was ${lastWorking[index]!.weightKg} × ${lastWorking[index]!.reps}`
            : plan.wasLabel,
        confirmedId: null,
      })),
    });
  }
  const picked = selectWorkoutExercises(exercises, version).map((exercise) => {
    const setCount = scaleWorkoutSetCount(exercise.sets.length, version);
    return {
      ...exercise,
      planLabel: `${setCount} sets × ${exercise.sets[0]?.reps ?? 8} reps`,
      sets: exercise.sets.slice(0, setCount),
    };
  });
  return {
    title:
      version === 'minimum'
        ? 'A shorter session'
        : last?.notes?.trim() || 'Today’s session',
    deload,
    version,
    exercises: picked,
  };
}

function draftsFromConfirmed(rows: LocalWorkoutSet[]): DraftExercise[] {
  return groupSets(rows).map((group) => {
    const working = group.sets.map((set) => ({
      weightKg: Number(set.weight_kg),
      reps: set.reps,
    }));
    const orm = bestE1rmFromSets(working);
    return {
      exerciseId: group.exerciseId,
      name: group.name,
      suggestLabel: working[0] ? `${working[0].weightKg} kg × ${working[0].reps}` : '—',
      ormLabel: orm === null ? '—' : `${Math.round(orm)} kg`,
      lastWas: 'confirmed',
      planLabel: `${working.length} sets`,
      deload: false,
      note: '',
      sets: group.sets.map((set) => ({
        key: set.id,
        weightKg: Number(set.weight_kg),
        reps: set.reps,
        lastLabel: 'confirmed',
        confirmedId: set.id,
      })),
    };
  });
}

export function WorkoutFlow({
  userId,
  timeZone,
  dayStartsAt,
  now,
  activeWorkout,
  version = 'standard',
  onClose,
  onFinished,
}: {
  userId: string;
  timeZone: string;
  dayStartsAt: string;
  now: number;
  activeWorkout: LocalWorkout | null;
  version?: WorkoutVersion;
  onClose: () => void;
  onFinished: () => Promise<void> | void;
}) {
  const [phase, setPhase] = useState<WorkoutPhase>(activeWorkout ? 'active' : 'proposed');
  const [title, setTitle] = useState('Today’s session');
  const [deload, setDeload] = useState(false);
  const [exercises, setExercises] = useState<DraftExercise[]>([]);
  const [workout, setWorkout] = useState<LocalWorkout | null>(activeWorkout);
  const [sheet, setSheet] = useState<SetSheet | null>(null);
  const [restEndsAt, setRestEndsAt] = useState<string | null>(null);
  const [restSnoozes, setRestSnoozes] = useState(0);
  const restNotified = useRef<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [addName, setAddName] = useState('');
  const [noteTarget, setNoteTarget] = useState<number | null>(null);
  const [noteText, setNoteText] = useState('');
  const [platesOpen, setPlatesOpen] = useState(false);
  const [summary, setSummary] = useState<{
    setCount: number;
    minutes: number;
    volume: number;
    rows: Array<{ name: string; kg: string; delta: string; dip: boolean }>;
  } | null>(null);

  const loadActive = useCallback(async (row: LocalWorkout) => {
    const sets = await listLocalWorkoutSets(row.id);
    setExercises(draftsFromConfirmed(sets));
    setWorkout(row);
    setTitle(row.notes?.trim() || 'Today’s session');
    setDeload(row.is_deload);
    const timer = await getLocalRestTimer(row.id);
    setRestEndsAt(timer?.ends_at ?? null);
    setPhase('active');
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (activeWorkout) {
        await loadActive(activeWorkout);
        return;
      }
      const proposal = await buildProposal(userId, version);
      if (cancelled) return;
      setTitle(proposal.title);
      setDeload(proposal.deload);
      setExercises(proposal.exercises);
    })();
    return () => {
      cancelled = true;
    };
  }, [activeWorkout, loadActive, userId, version]);

  const restLeft = restEndsAt ? Math.max(0, Math.ceil((Date.parse(restEndsAt) - now) / 1000)) : 0;
  const restActive = Boolean(restEndsAt) && restLeft > 0;
  const restDone = Boolean(restEndsAt) && restLeft === 0;
  const extraRest = restActive && restSnoozes > 0;
  const nextOpen = exercises
    .flatMap((exercise) => exercise.sets.map((set, setIndex) => ({ exercise, set, setIndex })))
    .find((row) => !row.set.confirmedId);
  const confirmedCount = exercises.reduce(
    (sum, exercise) => sum + exercise.sets.filter((set) => set.confirmedId).length,
    0,
  );
  const totalSets = exercises.reduce((sum, exercise) => sum + exercise.sets.length, 0);
  const plateKg = sheet?.weightKg ?? exercises.flatMap((exercise) => exercise.sets).find((set) => !set.confirmedId)?.weightKg ?? 60;
  const plates = useMemo(() => {
    try {
      return calculatePlatesPerSide({ targetKg: plateKg });
    } catch {
      return null;
    }
  }, [plateKg]);

  async function startRest(workoutId: string) {
    const timer = await startLocalRestTimer({ workoutId, userId, seconds: REST_SECONDS });
    setRestSnoozes(0);
    setRestEndsAt(timer.ends_at);
  }

  async function bumpRest(countSnooze: boolean) {
    if (!workout) return;
    const existing = await getLocalRestTimer(workout.id);
    const row = existing
      ? await extendLocalRestTimer(workout.id, 30)
      : await startLocalRestTimer({ workoutId: workout.id, userId, seconds: 30 });
    if (row) {
      if (countSnooze) setRestSnoozes((count) => count + 1);
      setRestEndsAt(row.ends_at);
    }
  }

  async function dismissRest() {
    if (!workout) return;
    await clearLocalRestTimer(workout.id);
    setRestEndsAt(null);
    setRestSnoozes(0);
  }

  useEffect(() => {
    if (!restDone || !restEndsAt || restNotified.current === restEndsAt) return;
    restNotified.current = restEndsAt;
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    const label = nextOpen
      ? `${nextOpen.exercise.name}, set ${nextOpen.setIndex + 1}`
      : 'Your next set is ready';
    try {
      new Notification('Rest done', { body: label, tag: 'kayamo-rest' });
    } catch {
      // Permission can be granted while the constructor is still blocked.
    }
  }, [nextOpen, restDone, restEndsAt]);

  async function confirmSet(exerciseIndex: number, setIndex: number, weightKg: number, reps: number) {
    const current = workout;
    if (!current) return;
    const exercise = exercises[exerciseIndex];
    const draft = exercise?.sets[setIndex];
    if (!exercise || !draft || draft.confirmedId) return;
    const row = await completeLocalWorkoutSet({
      userId,
      workoutId: current.id,
      exerciseId: exercise.exerciseId,
      exerciseName: exercise.name,
      exerciseOrder: exerciseIndex,
      setIndex: setIndex + 1,
      weightKg,
      reps,
      restSeconds: REST_SECONDS,
    });
    setExercises((list) =>
      list.map((item, index) =>
        index !== exerciseIndex
          ? item
          : {
              ...item,
              sets: item.sets.map((set, inner) =>
                inner !== setIndex
                  ? set
                  : { ...set, weightKg, reps, confirmedId: row.id, lastLabel: 'confirmed' },
              ),
            },
      ),
    );
    await startRest(current.id);
  }

  async function startSession(empty: boolean) {
    const row = await startLocalWorkout({
      userId,
      timeZone,
      dayStartsAt,
      isDeload: empty ? false : deload,
      notes: empty ? null : title,
    });
    setWorkout(row);
    if (empty) setExercises([]);
    setPhase('active');
  }

  async function finishSession() {
    if (!workout) return;
    const started = Date.parse(workout.started_at);
    const finished = await finishLocalWorkout({ id: workout.id, userId });
    const sets = await listLocalWorkoutSets(workout.id);
    const grouped = groupSets(sets);
    const endedAt = finished?.ended_at ?? new Date().toISOString();
    const minutes = Math.max(1, Math.round((Date.parse(endedAt) - started) / 60_000));
    const volume = grouped.reduce(
      (sum, group) =>
        sum + sessionVolumeKg(group.sets.map((set) => ({ weightKg: Number(set.weight_kg), reps: set.reps }))),
      0,
    );
    const history = (await listLocalWorkoutHistory(userId)).filter((row) => row.status === 'completed' && row.id !== workout.id);
    const rows = [];
    for (const group of grouped) {
      const nowBest = bestE1rmFromSets(group.sets.map((set) => ({ weightKg: Number(set.weight_kg), reps: set.reps })));
      let previous: number | null = null;
      for (const past of history.slice(0, 8)) {
        const pastSets = (await listLocalWorkoutSets(past.id)).filter((set) => set.exercise_id === group.exerciseId);
        if (pastSets.length === 0) continue;
        previous = bestE1rmFromSets(pastSets.map((set) => ({ weightKg: Number(set.weight_kg), reps: set.reps })));
        break;
      }
      const dip = Boolean(workout.is_deload);
      let delta = 'needs 2 more';
      if (nowBest !== null && previous !== null) {
        const change = Math.round(nowBest - previous);
        delta = dip ? `${change >= 0 ? '+' : ''}${change} · deload` : `${change >= 0 ? '+' : ''}${change} kg`;
      } else if (nowBest !== null) {
        delta = 'first read';
      }
      rows.push({
        name: group.name,
        kg: nowBest === null ? '—' : String(Math.round(nowBest)),
        delta,
        dip,
      });
    }
    setSummary({
      setCount: sets.length,
      minutes,
      volume: Math.round(volume),
      rows,
    });
    setRestEndsAt(null);
    setPhase('done');
    await onFinished();
  }

  const finishLabel =
    confirmedCount === 0 ? 'Finish workout' : `Finish · ${confirmedCount} of ${totalSets} sets`;

  if (phase === 'proposed') {
    return (
      <div className={styles.flowOverlay}>
        <div className={styles.flowWash} aria-hidden="true" />
        <div className={styles.flowTop}>
          <button type="button" className={styles.iconButton} aria-label="Back to Physical Self" onClick={onClose}>
            <ArrowLeft size={21} />
          </button>
          <span className={styles.eyebrow}>workout</span>
        </div>
        <div className={styles.flowScroll}>
          <h1 className={styles.flowTitle}>{title}, if you want it.</h1>
          <p className={styles.flowLead}>
            {WORKOUT_VERSION_LABELS[version]}. Built from your last sessions. Nothing is recorded until you confirm each set.
          </p>
          {deload ? (
            <div className={styles.engineBanner}>
              <ArrowBendDownLeft size={18} weight="fill" />
              <div>
                <div className={styles.engineBannerHead}>
                  <p>Deload week</p>
                  <span>engine</span>
                </div>
                <p>
                  Same weight, about half the sets. The engine holds load and cuts volume. You can
                  override any number.
                </p>
              </div>
            </div>
          ) : null}
          <p className={styles.eyebrow}>
            Proposed · {exercises.length} {exercises.length === 1 ? 'exercise' : 'exercises'}
          </p>
          {exercises.length === 0 ? (
            <p className={styles.mutedNote}>No recent session to copy. Start empty, then add lifts as you go.</p>
          ) : (
            exercises.map((exercise) => (
              <div className={styles.proposalCard} key={exercise.exerciseId}>
                <div>
                  <p>{exercise.name}</p>
                  <small>{exercise.planLabel}</small>
                </div>
                <div>
                  <strong>
                    {exercise.sets[0]?.weightKg}
                    <span> kg</span>
                  </strong>
                  <small>{exercise.lastWas}</small>
                </div>
              </div>
            ))
          )}
          <p className={styles.mutedNote}>You can add or drop exercises after you start.</p>
        </div>
        <div className={styles.flowFooter}>
          <button className={styles.primaryButton} type="button" onClick={() => void startSession(false)}>
            Start this session
          </button>
          <button className={styles.ghostWide} type="button" onClick={() => void startSession(true)}>
            Start empty instead
          </button>
        </div>
      </div>
    );
  }

  if (phase === 'done' && summary) {
    const setWord = summary.setCount === 1 ? 'set' : 'sets';
    return (
      <div className={styles.flowOverlay}>
        <div className={styles.flowWash} aria-hidden="true" />
        <div className={styles.flowScroll}>
          <div className={styles.doneHero}>
            <Image src="/coco-seed.png" alt="Coco" width={104} height={104} />
            <h1 className={styles.flowTitle}>
              Tapos. {summary.setCount} {setWord}, confirmed.
            </h1>
            <p className={styles.flowLead}>
              Saved on this device and queued to sync. Nothing here came from Coco guessing.
            </p>
          </div>
          <div className={styles.doneGrid}>
            <div>
              <p>
                {summary.minutes}
                <span> min</span>
              </p>
              <small>session</small>
            </div>
            <div>
              <p>
                {summary.volume.toLocaleString('en')}
                <span> kg</span>
              </p>
              <small>volume</small>
            </div>
          </div>
          <p className={styles.eyebrow}>Estimated 1RM, from your sets</p>
          <div className={styles.ormCard}>
            {summary.rows.map((row) => (
              <div key={row.name}>
                <span>{row.name}</span>
                <strong>
                  {row.kg}
                  <i> kg</i>
                </strong>
                <small>{row.delta}</small>
              </div>
            ))}
            <p>
              Estimates from confirmed sets. A deload week reads as a dip, not a loss.
            </p>
          </div>
          <div className={styles.pointsCard}>
            <Tree size={21} weight="fill" />
            <p>
              Coco recorded one confirmed workout.{' '}
              <span>+{COMPANION_EVENT_POINTS.workout_completed} toward the next stage.</span>
            </p>
          </div>
        </div>
        <div className={styles.flowFooter}>
          <button className={styles.primaryButton} type="button" onClick={onClose}>
            Back to Health
          </button>
        </div>
      </div>
    );
  }

  if (extraRest) {
    return (
      <div className={`${styles.flowOverlay} ${styles.flowSolid}`}>
        <div className={styles.activeHeader}>
          <button type="button" className={styles.iconButton} aria-label="Leave, keep the session running" onClick={onClose}>
            <ArrowLeft size={21} />
          </button>
          <div>
            <h1>{title}</h1>
            <p>
              {confirmedCount} {confirmedCount === 1 ? 'set' : 'sets'} confirmed · saved on device
            </p>
          </div>
        </div>
        <div className={styles.extraRest}>
          <p className={styles.eyebrow}>Extra rest</p>
          <p className={styles.extraRestClock} role="timer" aria-label={`${restLeft} seconds of extra rest remaining`}>
            {clock(restLeft)}
          </p>
          <p>
            {restSnoozes === 1
              ? 'Thirty more seconds on this set. Coco will not comment on it, and it changes nothing in your record.'
              : restSnoozes === 2
                ? 'Second extension on this set. Coco will not comment on it, and it changes nothing in your record.'
                : `${restSnoozes} extensions on this set. Coco will not comment on it, and it changes nothing in your record.`}
          </p>
          <div className={styles.extraRestActions}>
            <button className={styles.primaryButton} type="button" onClick={() => void dismissRest()}>
              I am ready now
            </button>
            <button className={styles.secondaryButton} type="button" onClick={() => void bumpRest(true)}>
              +30s
            </button>
          </div>
          <Image src="/coco-seed.png" alt="" width={96} height={96} />
        </div>
      </div>
    );
  }

  return (
    <div className={`${styles.flowOverlay} ${styles.flowSolid}`}>
      <div className={styles.activeHeader}>
        <button
          type="button"
          className={styles.iconButton}
          aria-label="Leave, keep the session running"
          onClick={onClose}
        >
          <ArrowLeft size={21} />
        </button>
        <div>
          <h1>{title}</h1>
          <p>
            {confirmedCount} {confirmedCount === 1 ? 'set' : 'sets'} confirmed · saved on device
          </p>
        </div>
        <button type="button" className={styles.plateButton} aria-label="Plate helper" onClick={() => setPlatesOpen(true)}>
          <Barbell size={20} />
        </button>
      </div>
      <div className={styles.flowScroll}>
        {exercises.map((exercise, exerciseIndex) => (
          <div className={styles.liftCard} key={exercise.exerciseId}>
            <div className={styles.liftHead}>
              <p>{exercise.name}</p>
              <span>
                {exercise.sets.filter((set) => set.confirmedId).length} of {exercise.sets.length} done
              </span>
            </div>
            <div className={styles.liftMeta}>
              <span>suggests {exercise.suggestLabel}</span>
              <small>1RM {exercise.ormLabel}</small>
            </div>
            {exercise.sets.map((set, setIndex) => (
              <div className={styles.setRow} key={set.key}>
                <span>{setIndex + 1}</span>
                <button
                  type="button"
                  disabled={Boolean(set.confirmedId)}
                  onClick={() => setSheet({ exerciseIndex, setIndex, weightKg: set.weightKg, reps: set.reps })}
                  aria-label={`Edit set ${setIndex + 1}, ${set.weightKg} kilos by ${set.reps} reps`}
                >
                  <strong>
                    {set.weightKg}
                    <i> kg</i>
                  </strong>
                  <strong>
                    {set.reps}
                    <i> reps</i>
                  </strong>
                  <small>{set.lastLabel}</small>
                </button>
                <button
                  type="button"
                  className={set.confirmedId ? styles.setDone : styles.setCheck}
                  aria-pressed={Boolean(set.confirmedId)}
                  aria-label={
                    set.confirmedId
                      ? `Set ${setIndex + 1} confirmed`
                      : `Confirm ${set.weightKg} kilos by ${set.reps} reps`
                  }
                  onClick={() => {
                    if (!set.confirmedId) void confirmSet(exerciseIndex, setIndex, set.weightKg, set.reps);
                  }}
                >
                  {set.confirmedId ? <CheckCircle size={23} weight="fill" /> : <Circle size={23} />}
                </button>
              </div>
            ))}
            <div className={styles.liftActions}>
              <button
                type="button"
                onClick={() => {
                  const last = exercise.sets.at(-1);
                  setExercises((list) =>
                    list.map((item, index) =>
                      index !== exerciseIndex
                        ? item
                        : {
                            ...item,
                            sets: [
                              ...item.sets,
                              {
                                key: newKey(),
                                weightKg: last?.weightKg ?? 20,
                                reps: last?.reps ?? 8,
                                lastLabel: 'new set',
                                confirmedId: null,
                              },
                            ],
                          },
                    ),
                  );
                }}
              >
                Add set
              </button>
              <button
                type="button"
                onClick={() => {
                  setNoteTarget(exerciseIndex);
                  setNoteText(exercise.note);
                }}
              >
                Note
              </button>
            </div>
          </div>
        ))}
        <button className={styles.dashedAdd} type="button" onClick={() => setAddOpen(true)}>
          <Plus size={17} /> Add an exercise
        </button>
      </div>
      <div className={styles.flowFooter}>
        {restActive ? (
          <div className={styles.restBar} role="status">
            <Timer size={20} />
            <span>
              Rest · <b>{clock(restLeft)}</b>
            </span>
            <button type="button" onClick={() => void bumpRest(false)}>
              +30s
            </button>
            <button type="button" onClick={() => void dismissRest()}>
              Skip
            </button>
          </div>
        ) : null}
        {restDone ? (
          <div className={styles.restDone} role="status">
            <div className={styles.restDoneHead}>
              <CheckCircle size={21} weight="fill" />
              <p>Rest done.{nextOpen ? ` Set ${nextOpen.setIndex + 1} is ready.` : ''}</p>
            </div>
            <span>Ninety seconds. Take longer if you need it — the set is not going anywhere.</span>
            <div className={styles.restDoneActions}>
              <button type="button" onClick={() => void bumpRest(true)}>
                Rest 30s more
              </button>
              <button type="button" onClick={() => void dismissRest()}>
                Okay
              </button>
            </div>
          </div>
        ) : null}
        <button className={styles.primaryButton} type="button" onClick={() => void finishSession()}>
          {finishLabel}
        </button>
      </div>

      {sheet ? (
        <div className={styles.sheetScrim}>
          <button type="button" className={styles.sheetBackdrop} aria-label="Close" onClick={() => setSheet(null)} />
          <div className={styles.bottomSheet} role="dialog" aria-label="Edit set">
            <div className={styles.sheetHandle} aria-hidden="true" />
            <p>
              Set {sheet.setIndex + 1} · {exercises[sheet.exerciseIndex]?.name}
            </p>
            <small>
              {exercises[sheet.exerciseIndex]?.sets[sheet.setIndex]?.lastLabel.replace('was', 'last session')}
            </small>
            <div className={styles.stepperRow}>
              <span>Weight</span>
              <button type="button" aria-label="Less weight" onClick={() => setSheet({ ...sheet, weightKg: Math.max(0, sheet.weightKg - 2.5) })}>
                −
              </button>
              <b>{sheet.weightKg}</b>
              <button type="button" aria-label="More weight" onClick={() => setSheet({ ...sheet, weightKg: sheet.weightKg + 2.5 })}>
                +
              </button>
            </div>
            <div className={styles.stepperRow}>
              <span>Reps</span>
              <button type="button" aria-label="Fewer reps" onClick={() => setSheet({ ...sheet, reps: Math.max(1, sheet.reps - 1) })}>
                −
              </button>
              <b>{sheet.reps}</b>
              <button type="button" aria-label="More reps" onClick={() => setSheet({ ...sheet, reps: sheet.reps + 1 })}>
                +
              </button>
            </div>
            <div className={styles.sheetActions}>
              <button
                className={styles.primaryButton}
                type="button"
                onClick={() => {
                  const current = sheet;
                  setSheet(null);
                  setExercises((list) =>
                    list.map((item, index) =>
                      index !== current.exerciseIndex
                        ? item
                        : {
                            ...item,
                            sets: item.sets.map((set, inner) =>
                              inner !== current.setIndex
                                ? set
                                : { ...set, weightKg: current.weightKg, reps: current.reps },
                            ),
                          },
                    ),
                  );
                  void confirmSet(current.exerciseIndex, current.setIndex, current.weightKg, current.reps);
                }}
              >
                Save and confirm
              </button>
              <button className={styles.ghostWide} type="button" onClick={() => setSheet(null)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {addOpen ? (
        <div className={styles.sheetScrim}>
          <button type="button" className={styles.sheetBackdrop} aria-label="Close" onClick={() => setAddOpen(false)} />
          <form
            className={styles.bottomSheet}
            onSubmit={(event) => {
              event.preventDefault();
              const name = addName.trim();
              if (!name) return;
              setExercises((list) => [
                ...list,
                {
                  exerciseId: newKey(),
                  name,
                  suggestLabel: '20 kg × 8',
                  ormLabel: '—',
                  lastWas: 'new',
                  planLabel: '1 set × 8 reps',
                  deload: false,
                  note: '',
                  sets: [{ key: newKey(), weightKg: 20, reps: 8, lastLabel: 'new set', confirmedId: null }],
                },
              ]);
              setAddName('');
              setAddOpen(false);
            }}
          >
            <div className={styles.sheetHandle} aria-hidden="true" />
            <p>Add an exercise</p>
            <label htmlFor="lift-name">Name</label>
            <input id="lift-name" value={addName} onChange={(event) => setAddName(event.target.value)} autoFocus />
            <button className={styles.primaryButton} type="submit">
              Add to this session
            </button>
          </form>
        </div>
      ) : null}

      {noteTarget !== null ? (
        <div className={styles.sheetScrim}>
          <button type="button" className={styles.sheetBackdrop} aria-label="Close" onClick={() => setNoteTarget(null)} />
          <form
            className={styles.bottomSheet}
            onSubmit={(event) => {
              event.preventDefault();
              const index = noteTarget;
              setExercises((list) =>
                list.map((item, inner) => (inner === index ? { ...item, note: noteText } : item)),
              );
              setNoteTarget(null);
            }}
          >
            <div className={styles.sheetHandle} aria-hidden="true" />
            <p>Note · {exercises[noteTarget]?.name}</p>
            <textarea value={noteText} onChange={(event) => setNoteText(event.target.value)} rows={3} />
            <button className={styles.primaryButton} type="submit">
              Save note
            </button>
          </form>
        </div>
      ) : null}

      {platesOpen ? (
        <div className={styles.sheetScrim}>
          <button type="button" className={styles.sheetBackdrop} aria-label="Close" onClick={() => setPlatesOpen(false)} />
          <div className={styles.bottomSheet} role="dialog" aria-label="Plate helper">
            <div className={styles.sheetHandle} aria-hidden="true" />
            <div className={styles.sheetTitleRow}>
              <p>Plate helper</p>
              <button type="button" className={styles.iconButton} aria-label="Close" onClick={() => setPlatesOpen(false)}>
                <X size={18} />
              </button>
            </div>
            {plates ? (
              <p className={styles.flowLead}>
                {plateKg} kg on a 20 kg bar.{' '}
                {plates.platesPerSide.length === 0
                  ? 'No plates each side.'
                  : `${plates.platesPerSide.join(' + ')} kg each side.`}
                {plates.exact ? '' : ` Remainder ${plates.remainderKg} kg.`}
              </p>
            ) : (
              <p className={styles.flowLead}>Need a target at or above the bar to split plates.</p>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
