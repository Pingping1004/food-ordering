/** Remembers that the user just chose to sign out, so the route guard does not greet them with a "please sign in" toast. */
let markedAt = 0;

export const markIntentionalLogout = () => { markedAt = Date.now(); };

/** True for a few seconds after an intentional logout (a time window, so React strict-mode double effects behave). */
export const wasIntentionalLogout = (windowMs = 10_000) => Date.now() - markedAt < windowMs;
