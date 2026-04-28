export type ObsPlatform = 'bilibili' | 'douyin';
export type ObsQuality = 'smooth' | 'hd' | 'ultra';

export interface ObsPreset {
  platform: ObsPlatform;
  quality: ObsQuality;
  name: string;
  videoBitrateKbps: number;
  audioBitrateKbps: number;
  width: number;
  height: number;
  fps: number;
  keyframeIntervalSec: number;
}

export interface ObsConnectionOptions {
  address: string;
  authSecret?: string;
}

export interface ObsStreamSettings {
  server: string;
  key: string;
}

export interface ObsApplyPresetOptions {
  connection: ObsConnectionOptions;
  stream: ObsStreamSettings;
  preset: ObsPreset;
}

export interface ObsApplyPresetResult {
  ok: boolean;
  warnings: string[];
}

export const obsPresets: Record<ObsPlatform, Record<ObsQuality, ObsPreset>> = {
  bilibili: {
    smooth: {
      platform: 'bilibili',
      quality: 'smooth',
      name: 'B 站 流畅 720p30',
      videoBitrateKbps: 2500,
      audioBitrateKbps: 160,
      width: 1280,
      height: 720,
      fps: 30,
      keyframeIntervalSec: 2,
    },
    hd: {
      platform: 'bilibili',
      quality: 'hd',
      name: 'B 站 高清 1080p30',
      videoBitrateKbps: 4500,
      audioBitrateKbps: 192,
      width: 1920,
      height: 1080,
      fps: 30,
      keyframeIntervalSec: 2,
    },
    ultra: {
      platform: 'bilibili',
      quality: 'ultra',
      name: 'B 站 超清 1080p60',
      videoBitrateKbps: 6000,
      audioBitrateKbps: 192,
      width: 1920,
      height: 1080,
      fps: 60,
      keyframeIntervalSec: 2,
    },
  },
  douyin: {
    smooth: {
      platform: 'douyin',
      quality: 'smooth',
      name: '抖音 流畅 720p30',
      videoBitrateKbps: 2500,
      audioBitrateKbps: 160,
      width: 1280,
      height: 720,
      fps: 30,
      keyframeIntervalSec: 2,
    },
    hd: {
      platform: 'douyin',
      quality: 'hd',
      name: '抖音 高清 1080p30',
      videoBitrateKbps: 5000,
      audioBitrateKbps: 192,
      width: 1920,
      height: 1080,
      fps: 30,
      keyframeIntervalSec: 2,
    },
    ultra: {
      platform: 'douyin',
      quality: 'ultra',
      name: '抖音 超清 1080p60',
      videoBitrateKbps: 8000,
      audioBitrateKbps: 320,
      width: 1920,
      height: 1080,
      fps: 60,
      keyframeIntervalSec: 2,
    },
  },
};
