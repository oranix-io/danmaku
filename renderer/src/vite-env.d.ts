/// <reference types="vite/client" />
import type { ObsApplyPresetOptions, ObsApplyPresetResult } from '@common/obs';
import { obsPresets } from '@common/obs';

declare global {
  const danmaku: {
    open: (roomId: string) => void;
  };
  const obs: {
    presets: typeof obsPresets;
    applyPreset: (
      options: ObsApplyPresetOptions
    ) => Promise<ObsApplyPresetResult>;
  };
}
