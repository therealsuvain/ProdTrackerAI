import React, { forwardRef, memo, useImperativeHandle } from "react";

import {
  useLightningStrikerAnimation,
  type LightningStrikerAudioOptions,
  type LightningStrikerCanvasRef,
  type LightningStrikerStartOptions,
} from "./use-lightning-striker-animation";

const LIGHTNING_STRIKER_AUDIO_SOURCES: LightningStrikerAudioOptions = {
  strike: require("@/assets/easter-eggs/lighting-strike/thunder-clap-512544.mp3"),
  thunder: require("@/assets/easter-eggs/lighting-strike/thunder-rumble-321631.mp3"),
};

export type LightningStrikerOverlayHostHandle = {
  start: (options?: LightningStrikerStartOptions) => Promise<boolean>;
  cancel: () => void;
};

type LightningStrikerOverlayHostProps = {
  canvasRef: LightningStrikerCanvasRef;
};

/**
 * Keeps lightning/rain controller state local to this overlay component.
 * GlobalSearchScreen can trigger/cancel the effect imperatively without
 * re-rendering its entire search UI when strike/rain state changes.
 *
 * memo() also prevents unrelated GlobalSearchScreen updates from needlessly
 * re-rendering this host while its stable canvas ref remains unchanged.
 */
export const LightningStrikerOverlayHost = memo(
  forwardRef<
    LightningStrikerOverlayHostHandle,
    LightningStrikerOverlayHostProps
  >(function LightningStrikerOverlayHost({ canvasRef }, ref) {
    const controller = useLightningStrikerAnimation(
      LIGHTNING_STRIKER_AUDIO_SOURCES,
    );

    useImperativeHandle(
      ref,
      () => ({
        start: (options) => controller.start(canvasRef, options),
        cancel: controller.cancel,
      }),
      [canvasRef, controller.start, controller.cancel],
    );

    return <>{controller.overlayLayer}</>;
  }),
);

LightningStrikerOverlayHost.displayName = "LightningStrikerOverlayHost";
