import './App.css';
import { useLocalStorageState, useSetState } from 'ahooks';
import {
  Box,
  Button,
  Field,
  Grid,
  GridItem,
  Input,
  ListItem,
  ListRoot,
} from '@chakra-ui/react';
import React from 'react';
import uniq from 'lodash/uniq';
import { useEffect, useState } from 'react';
import { WebviewWithController } from '@/components/webview-controller';
import type { ObsPlatform, ObsQuality } from '@common/obs';

const SENSITIVE_DATA_CLEAR_TIMEOUT_MS = 10 * 60 * 1000;

function App() {
  const [roomId, setRoomId] = useLocalStorageState('roomId', {
    defaultValue: '',
  });
  const [obsPlatform, setObsPlatform] = useLocalStorageState<ObsPlatform>(
    'obsPlatform',
    {
      defaultValue: 'bilibili',
    }
  );
  const [obsQuality, setObsQuality] = useLocalStorageState<ObsQuality>(
    'obsQuality',
    {
      defaultValue: 'hd',
    }
  );
  const [obsAddress, setObsAddress] = useLocalStorageState('obsAddress', {
    defaultValue: 'ws://127.0.0.1:4455',
  });
  const [obsPassword, setObsPassword] = useState('');
  const [rtmpServer, setRtmpServer] = useState('');
  const [streamKey, setStreamKey] = useState('');
  const [obsApplyStatus, setObsApplyStatus] = useState<{
    type: 'success' | 'error';
    message: string;
  }>();

  const [settings, setSettings] = useLocalStorageState('settings', {
    defaultValue: {},
    deserializer: JSON.parse,
    serializer: JSON.stringify,
  });

  const renderDanmaku = () => {
    return (
      <Box className='danmaku-entry'>
        <h1>请输入房间号</h1>
        <input
          value={roomId}
          onChange={(event) => {
            setRoomId(event.target.value);
          }}
        ></input>
        {renderHistory()}
        <Box className='card'>
          <Button
            onClick={() => {
              if (!roomId) {
                alert('请输入房间号');
                return;
              }

              setHistory(uniq([roomId, ...(history ?? [])]));
              danmaku.open(roomId);
            }}
          >
            Open Danmaku Page
          </Button>
        </Box>
      </Box>
    );
  };

  const renderObsSettings = () => {
    const preset = obs.presets[obsPlatform ?? 'bilibili'][obsQuality ?? 'hd'];
    return (
      <Box className='obs-settings'>
        <Box display='flex' flexDirection='column' gap={4}>
          <Box>
            <h1>OBS 一键配置</h1>
            <Box>
              选择平台和清晰度后，会通过 OBS WebSocket 写入推荐编码、码率、分辨率、帧率、关键帧和自定义 RTMP。推流地址和密钥需要从平台开播页面手动填写，不会保存到本地。
            </Box>
          </Box>

          <Box display='grid' gridTemplateColumns='repeat(2, minmax(0, 1fr))' gap={4} alignItems='flex-start'>
            <Field.Root>
              <Field.Label>平台</Field.Label>
              <select
                value={obsPlatform}
                onChange={(e) => setObsPlatform(e.target.value as ObsPlatform)}
              >
                <option value='bilibili'>B 站</option>
                <option value='douyin'>抖音</option>
              </select>
            </Field.Root>
            <Field.Root>
              <Field.Label>清晰度</Field.Label>
              <select
                value={obsQuality}
                onChange={(e) => setObsQuality(e.target.value as ObsQuality)}
              >
                <option value='smooth'>流畅 720p30</option>
                <option value='hd'>高清 1080p30</option>
                <option value='ultra'>超清 1080p60</option>
              </select>
            </Field.Root>
          </Box>

          <Box className='obs-preset-summary'>
            <Box>当前预设：{preset.name}</Box>
            <Box>
              H.264 / CBR / {preset.videoBitrateKbps} kbps /{' '}
              {preset.width}x{preset.height} / {preset.fps} FPS / 关键帧{' '}
              {preset.keyframeIntervalSec} 秒 / AAC {preset.audioBitrateKbps}{' '}
              kbps
            </Box>
          </Box>

          <Box display='grid' gridTemplateColumns='repeat(2, minmax(0, 1fr))' gap={4} alignItems='flex-start'>
            <Field.Root>
              <Field.Label>OBS WebSocket 地址</Field.Label>
              <Input
                value={obsAddress}
                onChange={(e) => setObsAddress(e.target.value)}
                placeholder='ws://127.0.0.1:4455'
              />
              <Field.HelperText>
                OBS 28+ 默认端口通常是 4455，请先在 OBS 中启用 WebSocket。
              </Field.HelperText>
            </Field.Root>
            <Field.Root>
              <Field.Label>OBS WebSocket 密码</Field.Label>
              <Input
                value={obsPassword}
                onChange={(e) => setObsPassword(e.target.value)}
                type='password'
                placeholder='未设置密码可留空'
              />
              <Field.HelperText>密码不会保存。</Field.HelperText>
            </Field.Root>
          </Box>

          <Field.Root>
            <Field.Label>RTMP 服务器地址</Field.Label>
            <Input
              value={rtmpServer}
              onChange={(e) => setRtmpServer(e.target.value)}
              placeholder='rtmp://...'
            />
            <Field.HelperText>
              请从 B 站直播中心、抖音直播后台或直播伴侣复制平台给出的地址。
            </Field.HelperText>
          </Field.Root>

          <Field.Root>
            <Field.Label>推流密钥</Field.Label>
            <Input
              value={streamKey}
              onChange={(e) => setStreamKey(e.target.value)}
              type='password'
              placeholder='平台提供的 Stream Key'
            />
            <Field.HelperText>推流密钥不会保存，也不会写入本地配置。</Field.HelperText>
          </Field.Root>

          <Button
            colorScheme='blue'
            onClick={async () => {
              setObsApplyStatus(undefined);
              try {
                const result = await obs.applyPreset({
                  connection: {
                    address: obsAddress ?? '',
                    authSecret: obsPassword,
                  },
                  stream: {
                    server: rtmpServer,
                    key: streamKey,
                  },
                  preset,
                });
                setObsApplyStatus({
                  type: 'success',
                  message:
                    result.warnings.length > 0
                      ? `已应用主要配置，部分 OBS 输出参数未写入：${result.warnings.join(
                          '；'
                        )}`
                      : 'OBS 推流配置已应用。',
                });
                setObsPassword('');
                setRtmpServer('');
                setStreamKey('');
              } catch (error) {
                setObsApplyStatus({
                  type: 'error',
                  message:
                    error instanceof Error
                      ? error.message
                      : 'OBS 推流配置应用失败',
                });
              }
            }}
          >
            一键应用到 OBS
          </Button>

          {obsApplyStatus && (
            <Box
              color={obsApplyStatus.type === 'success' ? 'green.700' : 'red.700'}
              fontWeight='medium'
            >
              {obsApplyStatus.message}
            </Box>
          )}
        </Box>
      </Box>
    );
  };

  useEffect(() => {
    if (!obsPassword && !rtmpServer && !streamKey) {
      return;
    }

    const timeout = setTimeout(() => {
      setObsPassword('');
      setRtmpServer('');
      setStreamKey('');
    }, SENSITIVE_DATA_CLEAR_TIMEOUT_MS);

    return () => clearTimeout(timeout);
  }, [obsPassword, rtmpServer, streamKey]);

  const panes = {
    danmaku: {
      name: '弹幕姬',
      render: renderDanmaku,
    },
    roomManage: {
      name: '房间管理',
      component: WebviewWithController,
      props: {
        src: 'https://link.bilibili.com/p/center/index#/my-room/start-live',
        isPersist: true,
        partition: 'bilibili',
      },
      keepAlive: true,
      needClick: true,
    },
    obsSettings: {
      name: 'OBS 配置',
      render: renderObsSettings,
      keepAlive: true,
    },
    room: {
      disabled: !settings.roomId,
      name: '直播间',
      component: WebviewWithController,
      props: {
        src: `https://live.bilibili.com/${settings.roomId}`,
        isPersist: true,
        partition: 'bilibili',
      },
      keepAlive: true,
      needClick: true,
    },
    settings: {
      name: '设置',
      render: () => {
        return (
          <Box>
            <Box>设置</Box>
            <Field.Root>
              <Field.Label>直播间房号</Field.Label>
              <Input
                type='text'
                onChange={(e) => {
                  setSettings({
                    roomId: e.target.value,
                  });
                }}
                value={settings.roomId}
              />
              <Field.HelperText>用来设置侧边的直播间房号</Field.HelperText>
            </Field.Root>
          </Box>
        );
      },
      keepAlive: true,
    },
  } as Record<
    string,
    {
      name: string;
      disabled?: boolean;
      props?: Record<string, any>;
      render?: () => JSX.Element;
      component?: React.ComponentType | any;
      keepAlive?: boolean;
      needClick?: boolean;
    }
  >;
  const paneNames = Object.keys(panes);
  const [activePane, setActivePane] = useState(paneNames[0]);
  const [tabState, setTabState] = useSetState<{
    [key: string]: {
      activated: boolean;
    };
  }>({});

  const [history, setHistory] = useLocalStorageState<string[]>(
    'roomIdHistory',
    {
      defaultValue: [] as string[],
    }
  );

  const renderHistory = React.useCallback(() => {
    if (!history || history.length === 0) {
      return null;
    }
    return (
      <Box>
        <Box>History:</Box>
        {history.map((item) => {
          return (
            <Box
              pr={2}
              as='span'
              cursor={'pointer'}
              onClick={() => setRoomId(item)}
            >
              {item}
            </Box>
          );
        })}
      </Box>
    );
  }, [history, setRoomId]);

  return (
    <Grid
      templateAreas={`"header header"
                  "nav main"
                  "nav footer"`}
      gridTemplateRows={'0px 1fr 0px'}
      gridTemplateColumns={'150px 1fr'}
      h='100vh'
      w='100vw'
      gap='1'
      color='blackAlpha.700'
    >
      <GridItem area={'header'}></GridItem>
      <GridItem bg={'blue.300'} area={'nav'}>
        <ListRoot className='nav-bar' userSelect={'none'} gap={1}>
          {Object.entries(panes).map(([key, value]) => {
            if (value.disabled) {
              return null;
            }
            const tabActivated = tabState[key]?.activated;
            return (
              <ListItem
                key={value.name}
                className='nav-item'
                width={'100%'}
                padding={2}
                cursor={'pointer'}
                onClick={() => setActivePane(key)}
              >
                {value.name}

                {value.needClick && (
                  <Box
                    onClick={() => {
                      setTabState({
                        [key]: {
                          activated: !tabActivated,
                        },
                      });
                    }}
                  >
                    {tabActivated ? '▶️' : '⏸️'}
                  </Box>
                )}
              </ListItem>
            );
          })}
        </ListRoot>
      </GridItem>
      <GridItem bg={'green.300'} area={'main'}>
        {paneNames.map((key) => {
          const func = panes[key].render;
          const Component = panes[key].component;
          if (panes[key].keepAlive || activePane === key) {
            return (
              <Box
                key={key}
                style={{
                  display: activePane === key ? 'flex' : 'none',
                  height: '100%',
                  width: '100%',
                  overflow: 'hidden',
                }}
              >
                {panes[key].needClick && !tabState[key]?.activated ? (
                  <div>页面已暂停，请在侧边栏点击启动</div>
                ) : func ? (
                  func()
                ) : Component ? (
                  <Component {...panes[key].props} />
                ) : null}
              </Box>
            );
          }
          return null;
        })}
      </GridItem>
      <GridItem area={'footer'}></GridItem>
    </Grid>
  );
}

export default App;
