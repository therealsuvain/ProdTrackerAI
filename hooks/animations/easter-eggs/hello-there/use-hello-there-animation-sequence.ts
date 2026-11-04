import { useCallback, useRef, useState } from "react";

export type EasterEggAnimationKind = "hello-there" | "no-no-no" | "sleeping-z";

export type EasterEggAnimationLaunchers = Record<
  EasterEggAnimationKind,
  () => Promise<boolean>
>;

export type EasterEggAnimationSequence = {
  /**
   * First accepted press: Hello There.
   * Second accepted press: No No No.
   * Third and later presses during cooldown: Sleeping Z.
   * A tap while running is ignored and does not advance the sequence.
   */
  activate: (launchers: EasterEggAnimationLaunchers) => Promise<EasterEggAnimationSelection | null>;
  isRunning: boolean;
  /** The next effect, based on the current session sequence/cooldown. */
  getNextAnimation: () => EasterEggAnimationSelection;
  /** Reset the session sequence explicitly, for example when the search host is permanently disposed. */
  reset: () => void;
};
// Number of accepted taps after Hello There that intentionally produce
// no animation before No No No becomes available.
//
// Set to 0 to disable this behaviour.
// Increase to require more no-effect taps.
export const NO_OP_PRESSES_AFTER_HELLO_THERE = 2;
// More than one hour as requested. Starts when the THIRD animation begins.
export const SLEEPING_Z_COOLDOWN_MS = /* 90 * 60 */60 * 1000;
export type EasterEggAnimationSelection =
  | EasterEggAnimationKind
  | "no-op";
/**
 * Session-only press sequence. Nothing is persisted to AsyncStorage.
 * The cooldown is checked on the next accepted press; no background timer is needed.
 */
export function useEasterEggAnimationSequence(): EasterEggAnimationSequence {
  const nextStepRef = useRef(0);
  const cooldownUntilRef = useRef(0);
  const runningRef = useRef(false);
  const [isRunning, setIsRunning] = useState(false);

  const getNextAnimation = useCallback((): EasterEggAnimationSelection => {
    const now = Date.now();
    if (cooldownUntilRef.current > now) return "sleeping-z";
    if (cooldownUntilRef.current !== 0 && now >= cooldownUntilRef.current) return "hello-there";
    const step = nextStepRef.current;

    if (step === 0) return "hello-there";

    if (step <= NO_OP_PRESSES_AFTER_HELLO_THERE) {
      return "no-op";
    }

    if (step === NO_OP_PRESSES_AFTER_HELLO_THERE + 1) {
      return "no-no-no";
    }

    return "sleeping-z";
  }, []);

  const activate = useCallback(async (
    launchers: EasterEggAnimationLaunchers,
  ): Promise<EasterEggAnimationSelection | null> => {
    // Synchronous ref lock: repeated taps during an effect are completely ignored.
    if (runningRef.current) return null;

    const now = Date.now();
    const previousStep = nextStepRef.current;
    const previousCooldown = cooldownUntilRef.current;

    let animation: EasterEggAnimationKind;
    let nextStep: 0 | 1 | 2 | 3;

    if (cooldownUntilRef.current > now) {
      animation = "sleeping-z";
      nextStep = 3;
    } else {
      // Once the cooldown has expired, the next accepted press restarts at one.
      if (cooldownUntilRef.current !== 0 && now >= cooldownUntilRef.current) {
        cooldownUntilRef.current = 0;
        nextStepRef.current = 0;
      }

      const step = nextStepRef.current;
      // Consume the configured number of presses without launching an animation.
      if (
        step >= 1 &&
        step <= NO_OP_PRESSES_AFTER_HELLO_THERE &&
        cooldownUntilRef.current <= now
      ) {
        nextStepRef.current = step + 1;
        return "no-op";
      }

      if (step === 0) {
        animation = "hello-there";
        nextStep = 1;
      } else if (step === NO_OP_PRESSES_AFTER_HELLO_THERE + 1) {
        animation = "no-no-no";
        nextStep = NO_OP_PRESSES_AFTER_HELLO_THERE + 2;
      } else {
        animation = "sleeping-z";
        nextStep = NO_OP_PRESSES_AFTER_HELLO_THERE + 2;
        // Start the 90-minute cooldown when the first Sleeping Z run begins.
        cooldownUntilRef.current = now + SLEEPING_Z_COOLDOWN_MS;
      }
    }

    runningRef.current = true;
    setIsRunning(true);
    try {
      const completed = await launchers[animation]();
      if (completed) {
        nextStepRef.current = nextStep;
        return animation;
      }

      // If the animation could not start or was cancelled, don't consume a press.
      nextStepRef.current = previousStep;
      cooldownUntilRef.current = previousCooldown;
      return null;
    } catch (error) {
      nextStepRef.current = previousStep;
      cooldownUntilRef.current = previousCooldown;
      throw error;
    } finally {
      runningRef.current = false;
      setIsRunning(false);
    }
  }, []);

  const reset = useCallback(() => {
    if (runningRef.current) return;
    nextStepRef.current = 0;
    cooldownUntilRef.current = 0;
  }, []);

  return { activate, isRunning, getNextAnimation, reset };
}
