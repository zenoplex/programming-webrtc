import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Grid,
  Container,
  TextInput,
  Tooltip,
  Group,
  Button,
  Textarea,
  List,
  ThemeIcon,
  Avatar,
  UnstyledButton,
} from '@mantine/core';
import { io, Socket } from 'socket.io-client';
import { HomeIcon, ChatBubbleIcon, ReloadIcon } from '@modulz/radix-icons';
import { DEFAULT_THEME } from '@mantine/core';
import { randGitBranch, seed } from '@ngneat/falso';

seed('seed');

const Page = () => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [roomId, setRoomId] = useState(randGitBranch());

  useEffect(() => {
    const apiOrigin = process.env.NX_API_ORIGIN;
    const sc = io(`${apiOrigin}/${roomId}`, { autoConnect: false });
    sc.on('connect', () => {
      console.log('connect');
      setIsConnected(true);
    });

    sc.on('disconnect', (reason) => {
      console.log('disconnected:', reason);
      setIsConnected(false);
    });

    setSocket(sc);

    return () => {
      sc?.close();
    };
  }, [roomId]);

  const onJoinClick = useCallback(() => {
    if (isConnected) {
      socket?.close();
    } else {
      socket?.open();
    }
  }, [isConnected, socket]);

  
  const onGenerateRoomIdClick = useCallback(() => {
    setRoomId(randGitBranch());
  }, []);


  return (
    <Grid grow>
      <Grid.Col span={6}>
        <Group>
          <TextInput
            value={roomId}
            readOnly
            placeholder="Room id"
            required
            icon={<HomeIcon />}
            rightSection={
              <Tooltip label="Change room id">
                <UnstyledButton
                  style={{ lineHeight: 0 }}
                  onClick={onGenerateRoomIdClick}
                >
                  <ReloadIcon color={DEFAULT_THEME.colors.dark[1]} />
                </UnstyledButton>
              </Tooltip>
            }
          />

          <Button onClick={onJoinClick}>
            {!isConnected ? 'Join' : 'Leave'}
          </Button>
        </Group>
      </Grid.Col>
      <Grid.Col span={6}>
        <div style={{ height: '100%' }}>
          <Grid grow>
            <Grid.Col span={12}>
              <List
                spacing="xs"
                size="sm"
                center
                icon={
                  <ThemeIcon color="teal" size={24} radius="xl">
                    <Avatar color="cyan" radius="xl" size={24}>
                      MK
                    </Avatar>
                  </ThemeIcon>
                }
              >
                <List.Item>Clone or download repository from GitHub</List.Item>
                <List.Item>Install dependencies with yarn</List.Item>
                <List.Item>
                  To start development server run npm start command
                </List.Item>
                <List.Item>
                  Run tests to make sure your changes do not break the build
                </List.Item>
                <List.Item>Submit a pull request once you are done</List.Item>
              </List>
            </Grid.Col>
            <Grid.Col>
              <Group>
                <TextInput
                  icon={<ChatBubbleIcon />}
                  placeholder="Enter message"
                ></TextInput>
                <Button>Send</Button>
              </Group>
            </Grid.Col>
          </Grid>
        </div>
      </Grid.Col>
    </Grid>
  );
};

export default Page;
