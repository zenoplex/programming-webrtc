import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Grid,
  Container,
  Card,
  Text,
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
import {
  PEER_CONNECTED_EVENT,
  PEER_DISCONNECTED_EVENT,
} from '@programming-webrtc/shared';

seed('seed');

const mediaConstraits = {
  video: true,
  audio: false,
};

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

    sc.on(PEER_CONNECTED_EVENT, (...args) => {
      console.log(args);
    });

    sc.on(PEER_DISCONNECTED_EVENT, (...args) => {
      console.log(args);
    });

    setSocket(sc);

    return () => {
      sc?.close();
    };
  }, [roomId]);

  const [myStream, setMyStream] = useState<MediaStream | null>(null);

  useEffect(() => {
    (async () => {
      const stream = new MediaStream();
      const userMedia = await navigator.mediaDevices.getUserMedia(
        mediaConstraits
      );
      stream.addTrack(userMedia.getTracks()[0]);
      setMyStream(stream);
    })();
  }, []);

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
        <Grid>
          <Grid.Col span={12}>
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
        </Grid>
          
        <Grid>
          <Grid.Col span={6}>
            <Card shadow="sm" padding="lg">
              <Card.Section>
                <video 
                ref={v => v?.srcObject = myStream}
                autoPlay
      muted
      playsInline
      style={{ width: '100%'}}
       />
              </Card.Section>

              <Text weight={500} size="lg">
                You've won a million dollars in cash!
              </Text>

              <Text size="sm">
                Please click anywhere on this card to claim your reward, this is
                not a fraud, trust us
              </Text>
            </Card>
          </Grid.Col>
          <Grid.Col span={6}>
            <Card shadow="sm" padding="lg">
              <Card.Section>
                <video />
              </Card.Section>

              <Text weight={500} size="lg">
                You've won a million dollars in cash!
              </Text>

              <Text size="sm">
                Please click anywhere on this card to claim your reward, this is
                not a fraud, trust us
              </Text>
            </Card>
          </Grid.Col>
        </Grid>
        
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
