import type { CocoSafetyResult } from './contracts';

const SELF_HARM = [
  /\b(kill|hurt) myself\b/i,
  /\bdon't want to (be here|live)\b/i,
  /\bsuicid(?:e|al)\b/i,
  /\bend my life\b/i,
];

const MEDICAL_EMERGENCY = [
  /\b(chest pain|can't breathe|cannot breathe)\b/i,
  /\b(overdose|seizure|unconscious)\b/i,
  /\bsevere bleeding\b/i,
];

const EATING_DISORDER = [
  /\b(stop eating|not eat for days|starve myself)\b/i,
  /\bpurge|make myself vomit\b/i,
  /\bunder 800 calories\b/i,
];

const ABUSE = [
  /\bpartner (hits|hit|threatens|threatened) me\b/i,
  /\bnot safe at home\b/i,
];

function matchesAny(value: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(value));
}

export function evaluateCocoSafety(message: string): CocoSafetyResult {
  if (matchesAny(message, SELF_HARM)) {
    return {
      level: 'urgent',
      category: 'self_harm',
      allowModel: false,
      showEmergencyPrompt: true,
      message:
        "I'm really glad you told me. Please contact local emergency services or a crisis line now, and if you can, stay with someone you trust. Coco cannot provide emergency care.",
    };
  }
  if (matchesAny(message, MEDICAL_EMERGENCY)) {
    return {
      level: 'urgent',
      category: 'medical_emergency',
      allowModel: false,
      showEmergencyPrompt: true,
      message:
        'This may need urgent medical help. Contact local emergency services now. Coco cannot diagnose or provide emergency care.',
    };
  }
  if (matchesAny(message, ABUSE)) {
    return {
      level: 'urgent',
      category: 'abuse',
      allowModel: false,
      showEmergencyPrompt: true,
      message:
        'Your safety matters. If you are in immediate danger, contact local emergency services or move to a safer place if you can. Consider reaching out to someone you trust.',
    };
  }
  if (matchesAny(message, EATING_DISORDER)) {
    return {
      level: 'supportive_redirect',
      category: 'eating_disorder',
      allowModel: false,
      showEmergencyPrompt: false,
      message:
        "I can't help with starvation, purging, or unsafe restriction. You deserve support that protects your health; consider contacting a qualified clinician or someone you trust.",
    };
  }
  return {
    level: 'safe',
    category: 'none',
    allowModel: true,
    showEmergencyPrompt: false,
    message: null,
  };
}
