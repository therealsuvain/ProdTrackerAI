# v4 → v5 changes

1. Replaced the non-self-intersecting S/U path with a continuous inward spiral that contracts slightly over 1.5 turns and finishes completely beyond the opposite screen edge.
2. Position and body rotation are driven by one linear progress value; arc-length resampling keeps travel speed approximately constant, with no waypoint pauses.
3. Kept the complete rocket, flame and shadow tied to the same position/rotation/scale values.
4. Moved the projected shadow into the environment stack between the cloud-deck background and foreground cloud sprites.
5. Reduced cloud sprite opacity and overlap so the supplied cloud-deck image remains the dominant environment.
6. Made launch audio awaitable and await it before liftoff; the flight loop is awaited before the off-screen hold starts.
7. Memoized the audio hook's returned object to avoid changing effect dependencies on every render.
8. Preserved Act 0 tuning and the full-return idle sag (`toValue: 0`, duration proportional to `progressRef.current * idleSagMs`).
