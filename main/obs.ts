import crypto from 'node:crypto';
import WebSocket from 'ws';
import { ObsApplyPresetOptions, ObsApplyPresetResult } from 'common/obs';

interface ObsMessage {
  op: number;
  d?: any;
}

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (reason?: unknown) => void;
  timeout: NodeJS.Timeout;
}

const CONNECTION_TIMEOUT_MS = 8000;
const REQUEST_TIMEOUT_MS = 8000;

function hashBase64(value: string) {
  return crypto.createHash('sha256').update(value).digest('base64');
}

function buildAuthentication(authSecret: string, salt: string, challenge: string) {
  const secret = hashBase64(authSecret + salt);
  return hashBase64(secret + challenge);
}

function normalizeObsAddress(address: string) {
  const value = address.trim();
  if (!value) {
    throw new Error('请输入 OBS WebSocket 地址');
  }
  const url = new URL(value.includes('://') ? value : `ws://${value}`);
  if (url.protocol !== 'ws:' && url.protocol !== 'wss:') {
    throw new Error('OBS WebSocket 地址必须使用 ws:// 或 wss://');
  }
  if (!url.hostname) {
    throw new Error('OBS WebSocket 地址缺少主机名');
  }
  return url.toString();
}

function validateRtmpSettings(server: string, key: string) {
  const rtmpServer = server.trim();
  const streamKey = key.trim();
  if (!rtmpServer) {
    throw new Error('请输入平台提供的 RTMP 服务器地址');
  }
  if (!streamKey) {
    throw new Error('请输入平台提供的推流密钥');
  }
  if (!/^rtmps?:\/\//i.test(rtmpServer)) {
    throw new Error('RTMP 服务器地址必须以 rtmp:// 或 rtmps:// 开头');
  }
  return { rtmpServer, streamKey };
}

class ObsWebSocketClient {
  private websocket: WebSocket | undefined;
  private requestId = 0;
  private pendingRequests = new Map<string, PendingRequest>();

  async connect(address: string, authSecret?: string) {
    const url = normalizeObsAddress(address);
    const websocket = new WebSocket(url);
    this.websocket = websocket;

    await new Promise<void>((resolve, reject) => {
      const cleanup = () => {
        clearTimeout(timeout);
        websocket.off('error', onError);
        websocket.off('open', onOpen);
      };
      const onError = (error: Error) => {
        cleanup();
        reject(error);
      };
      const onOpen = () => {
        cleanup();
        resolve();
      };
      const timeout = setTimeout(() => {
        cleanup();
        reject(new Error('连接 OBS WebSocket 超时，请确认 OBS 已启动并开启 WebSocket 服务'));
        websocket.close();
      }, CONNECTION_TIMEOUT_MS);

      websocket.once('error', onError);
      websocket.once('open', onOpen);
    });

    websocket.on('message', (data) => this.handleMessage(data.toString()));
    websocket.once('close', () => {
      this.rejectPendingRequests(new Error('OBS WebSocket 连接已关闭'));
    });

    const hello = await this.waitForMessage(0);
    const authentication = hello.d?.authentication;
    const identifyData = {
      rpcVersion: 1,
      ...(authentication
        ? {
            authentication: buildAuthentication(
              authSecret ?? '',
              authentication.salt,
              authentication.challenge
            ),
          }
        : {}),
    };

    await this.sendAndWait({ op: 1, d: identifyData }, 2);
  }

  async request(requestType: string, requestData?: Record<string, unknown>) {
    if (!this.websocket || this.websocket.readyState !== WebSocket.OPEN) {
      throw new Error('OBS WebSocket 未连接');
    }

    const requestId = String(++this.requestId);
    const response = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(requestId);
        reject(new Error(`${requestType} 请求 OBS 超时`));
      }, REQUEST_TIMEOUT_MS);
      this.pendingRequests.set(requestId, { resolve, reject, timeout });
    });

    this.websocket.send(
      JSON.stringify({
        op: 6,
        d: {
          requestType,
          requestId,
          requestData,
        },
      })
    );

    return response;
  }

  close() {
    this.rejectPendingRequests(new Error('OBS WebSocket 连接已关闭'));
    this.websocket?.close();
  }

  private waitForMessage(op: number) {
    return new Promise<ObsMessage>((resolve, reject) => {
      const websocket = this.websocket;
      if (!websocket) {
        reject(new Error('OBS WebSocket 未连接'));
        return;
      }

      const onMessage = (data: WebSocket.RawData) => {
        const message = JSON.parse(data.toString()) as ObsMessage;
        if (message.op === op) {
          cleanup();
          resolve(message);
        }
      };
      const onError = (error: Error) => {
        cleanup();
        reject(error);
      };
      const onClose = () => {
        cleanup();
        reject(new Error('OBS WebSocket 连接已关闭'));
      };
      const cleanup = () => {
        websocket.off('message', onMessage);
        websocket.off('error', onError);
        websocket.off('close', onClose);
      };

      websocket.on('message', onMessage);
      websocket.once('error', onError);
      websocket.once('close', onClose);
    });
  }

  private sendAndWait(message: ObsMessage, responseOp: number) {
    const response = this.waitForMessage(responseOp);
    this.websocket?.send(JSON.stringify(message));
    return response;
  }

  private handleMessage(raw: string) {
    const message = JSON.parse(raw) as ObsMessage;
    if (message.op !== 7) {
      return;
    }

    const requestId = message.d?.requestId;
    const pendingRequest = this.pendingRequests.get(requestId);
    if (!pendingRequest) {
      return;
    }

    this.pendingRequests.delete(requestId);
    clearTimeout(pendingRequest.timeout);
    const status = message.d?.requestStatus;
    if (status?.result) {
      pendingRequest.resolve(message.d?.responseData);
    } else {
      pendingRequest.reject(
        new Error(status?.comment ?? `OBS 请求失败：${message.d?.requestType}`)
      );
    }
  }

  private rejectPendingRequests(error: Error) {
    for (const pendingRequest of this.pendingRequests.values()) {
      clearTimeout(pendingRequest.timeout);
      pendingRequest.reject(error);
    }
    this.pendingRequests.clear();
  }
}

async function requestBestEffort(
  client: ObsWebSocketClient,
  warnings: string[],
  requestType: string,
  requestData: Record<string, unknown>
) {
  try {
    await client.request(requestType, requestData);
  } catch (error) {
    warnings.push(
      `${requestType}: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

export async function applyObsPreset(
  options: ObsApplyPresetOptions
): Promise<ObsApplyPresetResult> {
  const preset = options.preset;
  const { rtmpServer, streamKey } = validateRtmpSettings(
    options.stream.server,
    options.stream.key
  );
  const client = new ObsWebSocketClient();
  const warnings: string[] = [];

  try {
    await client.connect(
      options.connection.address,
      options.connection.authSecret
    );

    await client.request('SetStreamServiceSettings', {
      streamServiceType: 'rtmp_custom',
      streamServiceSettings: {
        server: rtmpServer,
        key: streamKey,
        use_auth: false,
      },
    });

    await client.request('SetVideoSettings', {
      baseWidth: preset.width,
      baseHeight: preset.height,
      outputWidth: preset.width,
      outputHeight: preset.height,
      fpsNumerator: preset.fps,
      fpsDenominator: 1,
    });

    await requestBestEffort(client, warnings, 'SetProfileParameter', {
      parameterCategory: 'SimpleOutput',
      parameterName: 'StreamEncoder',
      parameterValue: 'x264',
    });
    await requestBestEffort(client, warnings, 'SetProfileParameter', {
      parameterCategory: 'SimpleOutput',
      parameterName: 'VBitrate',
      parameterValue: String(preset.videoBitrateKbps),
    });
    await requestBestEffort(client, warnings, 'SetProfileParameter', {
      parameterCategory: 'SimpleOutput',
      parameterName: 'ABitrate',
      parameterValue: String(preset.audioBitrateKbps),
    });
    await requestBestEffort(client, warnings, 'SetProfileParameter', {
      parameterCategory: 'SimpleOutput',
      parameterName: 'KeyframeIntSec',
      parameterValue: String(preset.keyframeIntervalSec),
    });

    return {
      ok: true,
      warnings,
    };
  } finally {
    client.close();
  }
}
