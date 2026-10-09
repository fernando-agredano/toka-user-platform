// Control and zero-width/bidi characters are used to hide instructions inside otherwise normal text.
const INVISIBLE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F​-\u200F\u202A-\u202E⁠-⁤﻿]/g;

const INJECTION_PATTERNS = [
  /ignora (?:todas )?(?:las|tus) instrucciones/i,
  /ignore (?:all )?(?:previous|prior|above) instructions/i,
  /system prompt/i,
  /eres ahora/i,
  /modo desarrollador|developer mode/i,
  /jailbreak/i,
];

export interface SanitizedInput {
  text: string;
  /** A signal for review only: legitimate security questions match these patterns too, so it never blocks. */
  injectionSuspected: boolean;
}

export function sanitizeUserInput(raw: string): SanitizedInput {
  const text = raw.replace(INVISIBLE, '').trim();
  return { text, injectionSuspected: INJECTION_PATTERNS.some((pattern) => pattern.test(text)) };
}
