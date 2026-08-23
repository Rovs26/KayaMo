import assert from 'node:assert/strict';
import { estimateTdee, restingEnergyKcal } from '@kayamo/core';

type Persona = {
  name: string;
  trueTdee: number;
  meanIntake: number;
  loggingPattern: (day: number) => boolean;
  formulaBias: number;
  whooshDay?: number;
};

const personas: Persona[] = [
  {
    name: 'cutting',
    trueTdee: 2_450,
    meanIntake: 1_950,
    loggingPattern: () => true,
    formulaBias: -0.12,
    whooshDay: 61,
  },
  {
    name: 'bulking',
    trueTdee: 2_700,
    meanIntake: 3_000,
    loggingPattern: () => true,
    formulaBias: 0.1,
  },
  {
    name: 'maintaining',
    trueTdee: 2_250,
    meanIntake: 2_250,
    loggingPattern: () => true,
    formulaBias: -0.1,
  },
  {
    name: 'erratic logger',
    trueTdee: 2_400,
    meanIntake: 2_200,
    loggingPattern: (day) => day % 2 === 0 || day % 7 === 0,
    formulaBias: 0.08,
  },
];

function dateFor(day: number): string {
  return new Date(Date.UTC(2026, 0, day + 1)).toISOString().slice(0, 10);
}

for (const persona of personas) {
  const baseProfile = {
    sex: 'male' as const,
    birthYear: 1996,
    heightCm: 175,
    weightKg: 80,
    activityMultiplier: 1.4,
  };
  const ree = restingEnergyKcal(baseProfile, dateFor(83));
  const profile = {
    ...baseProfile,
    activityMultiplier: (persona.trueTdee * (1 + persona.formulaBias)) / ree,
  };
  const intake = [];
  const weights = [];
  let weightKg = 80;
  for (let day = 0; day < 84; day += 1) {
    const intakeKcal = persona.meanIntake + Math.sin(day * 1.7) * 90;
    weightKg += (intakeKcal - persona.trueTdee) / 7_700;
    const waterNoise = Math.sin(day * 0.83) * 0.22;
    const whoosh = day === persona.whooshDay ? -1.5 : 0;
    const date = dateFor(day);
    intake.push({
      date,
      kcal: persona.loggingPattern(day) ? intakeKcal : null,
    });
    weights.push({ date, weightKg: weightKg + waterNoise + whoosh });
  }
  const estimate = estimateTdee({
    asOfDate: dateFor(83),
    profile,
    intake,
    weights,
  });
  const relativeError = Math.abs(estimate.tdeeKcal - persona.trueTdee) / persona.trueTdee;
  const tolerance = persona.name === 'erratic logger' ? 0.12 : 0.08;
  assert.ok(
    relativeError <= tolerance,
    `${persona.name} error ${(relativeError * 100).toFixed(1)}% exceeded ${(tolerance * 100).toFixed(0)}%`,
  );
  console.log(
    `${persona.name}: true=${persona.trueTdee}, estimated=${estimate.tdeeKcal}, method=${estimate.method}, completeness=${estimate.completeness}`,
  );
}
