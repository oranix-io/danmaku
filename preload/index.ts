import { contextBridge, ipcRenderer } from 'electron/renderer';
import { applyObsPresetChannel } from 'common/ipc';
import {
  ObsApplyPresetOptions,
  ObsApplyPresetResult,
  obsPresets,
} from 'common/obs';

export interface IMainWorld {
  danmaku: {
    open: (roomId: string) => void;
  };
  obs: {
    presets: typeof obsPresets;
    applyPreset: (
      options: ObsApplyPresetOptions
    ) => Promise<ObsApplyPresetResult>;
  };
}

contextBridge.exposeInMainWorld('danmaku', {
  open: async (roomId) => await ipcRenderer.invoke('open-danmaku', roomId),
} as IMainWorld['danmaku']);

contextBridge.exposeInMainWorld('obs', {
  presets: obsPresets,
  applyPreset: async (options) =>
    await ipcRenderer.invoke(applyObsPresetChannel, options),
} as IMainWorld['obs']);
