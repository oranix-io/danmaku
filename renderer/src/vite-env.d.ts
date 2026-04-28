/// <reference types="vite/client" />
import type { IMainWorld } from '../../preload';

declare global {
  const danmaku: IMainWorld['danmaku'];
  const obs: IMainWorld['obs'];
}

import type { IMainWorld } from '../../preload/index.d.ts';

declare global {
  const danmaku: IMainWorld['danmaku'];
}
