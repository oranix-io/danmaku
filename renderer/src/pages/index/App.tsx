import './App.css';
import { useLocalStorageState, useSetState } from 'ahooks';
import {
  Box,
  Button,
  Field,
  Grid,
  GridItem,
  ListRoot,
  ListItem,
} from '@chakra-ui/react';
import React from 'react';
import uniq from 'lodash/uniq';
import { useState } from 'react';
import { WebviewWithController } from '@/components/webview-controller';
import { Input } from '@chakra-ui/react';

function App() {
  const [roomId, setRoomId] = useLocalStorageState('roomId', {
    defaultValue: '',
  });

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
