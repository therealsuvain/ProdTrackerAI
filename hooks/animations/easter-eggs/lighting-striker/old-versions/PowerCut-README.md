# Lightning Striker — Power Cut scenario

Additive first rare-event implementation. Copy the hook and audio files, then follow `INTEGRATION-POWER-CUT.md` to connect it to the current integrated Lightning Striker controller.

The implementation uses a separate Expo Audio player group for the three blackout sounds, so it does not require rewriting the user's existing lightning strike/thunder audio helper. Normal visual completion does not stop the audio; explicit cancellation and unmount do.

The supplied rain/thunder and flickering-flames recordings are included for the later rain and fire scenarios but are not loaded or played by this first scenario.


The default clip-duration tuning values are based on decoded audio durations measured from the uploaded files. Adjust the duration and offset fields if your device player reports slightly different media durations due to MP3 encoder padding.
