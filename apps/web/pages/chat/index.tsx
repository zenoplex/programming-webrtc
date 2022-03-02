import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Grid,
  Card,
  Text,
  TextInput,
  Tooltip,
  Group,
  Button,
  List,
  ThemeIcon,
  Avatar,
  UnstyledButton,
} from '@mantine/core';
import { useForm } from '@mantine/hooks';
import { io, Socket } from 'socket.io-client';
import {
  HomeIcon,
  ChatBubbleIcon,
  ReloadIcon,
  StarFilledIcon,
  StarIcon,
} from '@modulz/radix-icons';
import { DEFAULT_THEME } from '@mantine/core';
import { randGitBranch, seed } from '@ngneat/falso';
import {
  PEER_CONNECTED_EVENT,
  PEER_DISCONNECTED_EVENT,
  SIGNAL_EVENT,
  ICE_SERVERS_RECEIVED_EVENT,
} from '@programming-webrtc/shared';
import Video from '../../components/Video';
// Firefox does not support onconnectionstatechange
import 'webrtc-adapter';

seed('seed');

const mediaConstraits = {
  video: true,
  audio: false,
};

const streamFilters = [
  undefined,
  'grayscale',
  'sepia',
  'noir',
  'psychedelic',
] as const;

interface Message {
  sender: string;
  message: string;
}

const Page = () => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isSocketConnected, setIsSocketConnected] = useState(false);
  const [peerConnectionState, setPeerConnectionState] = useState<
    RTCPeerConnectionState | undefined
  >();
  const [roomId, setRoomId] = useState(randGitBranch());
  const [myStreamFilter, setMyStreamFilter] =
    useState<typeof streamFilters[number]>();
  const [peerStreamFilter, setPeerStreamFilter] =
    useState<typeof streamFilters[number]>();
  const isPolite = useRef(false);
  const isMakingOffer = useRef(false);
  const isIgnoringOffer = useRef(false);
  const isSettingRemoteAnswerPending = useRef(false);
  const isSuppressingInitialOffer = useRef(false);
  const peer = useRef<RTCPeerConnection | null>(null);
  const peerChatChannel = useRef<RTCDataChannel | null>(null);
  const myStream = useRef<MediaStream | null>(null);
  const myVideoRef = useRef<HTMLVideoElement | null>(null);
  const peerVideoRef = useRef<HTMLVideoElement | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const messageQueue = useRef<string[]>([]);

  const form = useForm({
    initialValues: { message: '' },
  });
  const onSubmit = useCallback(
    async (values) => {
      setMessages((s) => [...s, { sender: 'me', message: values.message }]);
      // TODO: fix page style to cap height and add scrollTo
      if (
        peerChatChannel.current &&
        peerChatChannel.current.readyState === 'open'
      ) {
        const chatChannel = peerChatChannel.current;

        try {
          chatChannel.send(values.message);
        } catch (err) {
          console.error('Failed to send message', err);
          messageQueue.current.push(values.message);
        }
      } else {
        messageQueue.current.push(values.message);
      }

      form.setFieldValue('message', '');
    },
    [form]
  );

  useEffect(() => {
    const apiOrigin = process.env.NX_API_ORIGIN;
    const sc = io(`${apiOrigin}/${roomId}`, { autoConnect: false });
    sc.on('connect', () => {
      console.log('connect');
      setIsSocketConnected(true);
    });

    const onNegotiationNeeded = async () => {
      console.log('onNegotiationNeeded');
      if (!peer.current) return;
      const rpc = peer.current;
      if (isSuppressingInitialOffer.current) return;

      try {
        isMakingOffer.current = true;
        await rpc.setLocalDescription();
      } catch (err) {
        // Create SDP offer required by older browsers
        const offer = await rpc.createOffer();
        await rpc.setLocalDescription(offer);
      } finally {
        sc.emit(SIGNAL_EVENT, { description: rpc.localDescription });
        isMakingOffer.current = false;
      }
    };

    const onIceCandidate = (e: RTCPeerConnectionIceEvent) => {
      console.log('onIceCandidate');
      sc.emit(SIGNAL_EVENT, { candidate: e.candidate });
    };

    const onTrack = (e: RTCTrackEvent) => {
      console.log('ontrack', e);
      if (peerVideoRef.current) peerVideoRef.current.srcObject = e.streams[0];
    };

    const onConnectionStateChange = (e: Event) => {
      if (!peer.current) return;

      const rpc = peer.current;
      console.info('onConnectionStateChange', rpc.connectionState);
      setPeerConnectionState(rpc.connectionState);
    };

    const onDataChannel = (e: RTCDataChannelEvent) => {
      console.log('onDataChannel', e);
      const label = e.channel.label;
      if (label.startsWith('FILTER-')) {
        const filter = label.replace('FILTER-', '');
        setPeerStreamFilter(filter as typeof streamFilters[number]);
      }

      e.channel.onopen = () => {
        e.channel.close();
      };
    };

    const addStreamingMedia = (peer: RTCPeerConnection) => {
      if (myStream.current) {
        for (const track of myStream.current.getTracks()) {
          peer.addTrack(track, myStream.current);
        }
      }
    };

    const addChatChannel = (peer: RTCPeerConnection) => {
      const chatChannel = peer.createDataChannel('CHAT', {
        negotiated: true,
        id: 51,
      });

      chatChannel.onopen = () => {
        console.log('Chat channel open.');
        chatChannel.send('Hi!');

        // Send queued messages and clear the queue
        messageQueue.current.forEach((message) => {
          chatChannel.send(message);
        });
        messageQueue.current = [];
      };
      chatChannel.onmessage = (e: MessageEvent<string>) => {
        setMessages((s) => [...s, { sender: 'peer', message: e.data }]);
      };
      chatChannel.onclose = () => {
        console.log('Chat channel closed.');
      };
      peerChatChannel.current = chatChannel;
    };

    const resetAndRetryConnection = (rpc: RTCPeerConnection) => {
      console.info('resetAndRetryConnection');
      isMakingOffer.current = false;
      isIgnoringOffer.current = false;
      isSettingRemoteAnswerPending.current = false;
      isSuppressingInitialOffer.current = isPolite.current;

      if (peerVideoRef.current) peerVideoRef.current.srcObject = null;
      const config = rpc.getConfiguration();
      rpc.close();

      // TODO: get ICE servers from the server
      const newRpc = new RTCPeerConnection(config);
      newRpc.onnegotiationneeded = onNegotiationNeeded;
      newRpc.onicecandidate = onIceCandidate;
      newRpc.ontrack = onTrack;
      addStreamingMedia(newRpc);
      addChatChannel(newRpc);

      peer.current = newRpc;

      if (isPolite.current) {
        sc.emit(SIGNAL_EVENT, { description: { type: '_reset' } });
      }
    };

    // TODO: Need to type socket event
    sc.on(ICE_SERVERS_RECEIVED_EVENT, (iceServers) => {
      console.log(ICE_SERVERS_RECEIVED_EVENT, iceServers);

      const rpc = new RTCPeerConnection({ iceServers: iceServers });
      setPeerConnectionState(rpc.connectionState);
      rpc.onnegotiationneeded = onNegotiationNeeded;
      rpc.onicecandidate = onIceCandidate;
      rpc.ontrack = onTrack;
      rpc.onconnectionstatechange = onConnectionStateChange;
      rpc.ondatachannel = onDataChannel;
      addStreamingMedia(rpc);
      addChatChannel(rpc);

      peer.current = rpc;
    });

    sc.on('disconnect', (reason) => {
      console.log('disconnected:', reason);
      setIsSocketConnected(false);
    });

    sc.on(PEER_CONNECTED_EVENT, (...args) => {
      console.log('PEER_CONNECTED_EVENT', args);
      isPolite.current = true;
    });

    sc.on(PEER_DISCONNECTED_EVENT, (...args) => {
      console.log('PEER_DISCONNECTED_EVENT', args);
      if (peerVideoRef.current) peerVideoRef.current.srcObject = null;
      peer.current?.close();

      // TODO: should request new ice servers
      const rpc = new RTCPeerConnection(peer.current?.getConfiguration());
      rpc.onnegotiationneeded = onNegotiationNeeded;
      rpc.onicecandidate = onIceCandidate;
      rpc.ontrack = onTrack;
      rpc.onconnectionstatechange = onConnectionStateChange;
      rpc.ondatachannel = onDataChannel;
      addStreamingMedia(rpc);
      addChatChannel(rpc);

      peer.current = rpc;
    });

    sc.on(
      SIGNAL_EVENT,
      async ({
        description,
        candidate,
      }: {
        description?: RTCSessionDescription;
        candidate: RTCIceCandidate;
      }) => {
        console.log('SIGNAL_EVENT', `description: ${description?.type}`);

        if (!peer.current) return;
        const rpc = peer.current;

        // offer/answer
        if (description) {
          // @ts-expect-error patch for older browser
          if (description.type === '_reset') {
            resetAndRetryConnection(rpc);
            return;
          }

          // readyForOffer is true
          // 1) when not in middle of making an offer
          // 2) RTCSignalingState is stable OR isSettingRemoteAnswerPending is true
          const readyForOffer =
            !isMakingOffer.current &&
            (rpc.signalingState === 'stable' ||
              isSettingRemoteAnswerPending.current);
          const offerCollision = description.type === 'offer' && !readyForOffer;
          isIgnoringOffer.current = !isPolite.current && offerCollision;

          // ignore offer and exit callback
          if (isIgnoringOffer.current) {
            return;
          }

          // If not ignoring offers then has no choice but to respond
          isSettingRemoteAnswerPending.current = description.type === 'answer';
          try {
            // console.log('description', description);
            console.log('SingnalingState', rpc.signalingState);
            await rpc.setRemoteDescription(description);
          } catch (err) {
            // Safari will not accpet { type: 'rollback' } thus needs to reset
            // Maybe will be fixed on Safari 15.4
            // https://bugs.webkit.org/show_bug.cgi?id=174656
            resetAndRetryConnection(rpc);
            return;
          }
          isSettingRemoteAnswerPending.current = false;

          // Has to respond to remote peer's offer
          if (description.type === 'offer') {
            try {
              await rpc.setLocalDescription();
            } catch (err) {
              // Create SDP answer required by older browsers
              const answer = await rpc.createAnswer();
              await rpc.setLocalDescription(answer);
            } finally {
              sc.emit(SIGNAL_EVENT, { description: rpc.localDescription });
              isSuppressingInitialOffer.current = false;
            }
          }
          // Handle ICE candidate
        } else if (candidate) {
          try {
            await rpc.addIceCandidate(candidate);
          } catch (e) {
            // Log error unless ignoring offers and candidate is not an empty string
            if (!isIgnoringOffer.current && candidate.candidate.length > 1) {
              console.error('Unable to add ICE candidate for peer:', e);
            }
          }
        }
      }
    );

    setSocket(sc);

    return () => {
      sc?.close();
    };
  }, [roomId]);

  useEffect(() => {
    (async () => {
      const stream = new MediaStream();
      const userMedia = await navigator.mediaDevices.getUserMedia(
        mediaConstraits
      );
      stream.addTrack(userMedia.getTracks()[0]);
      if (myVideoRef.current) myVideoRef.current.srcObject = stream;
      myStream.current = stream;
    })();
  }, []);

  const onJoinClick = useCallback(() => {
    if (isSocketConnected) {
      socket?.close();
      if (peerVideoRef.current) peerVideoRef.current.srcObject = null;
      peer.current?.close();
      peer.current = null;
    } else {
      socket?.open();
    }
  }, [isSocketConnected, socket]);

  const onMyVideoClick = useCallback(() => {
    if (
      myVideoRef.current &&
      peer.current &&
      peerConnectionState === 'connected'
    ) {
      const currentFilterIndex = streamFilters.indexOf(myStreamFilter);
      const nextFilter =
        streamFilters[(currentFilterIndex + 1) % streamFilters.length];
      setMyStreamFilter(nextFilter);

      const label = `FILTER-${nextFilter}`;
      const dataChannel = peer.current.createDataChannel(label);
      dataChannel.onclose = () => {
        console.log(`Remote peer has closed the ${label} data channel`);
      };
    }
  }, [myStreamFilter, peerConnectionState]);

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
                {!isSocketConnected ? 'Join' : 'Leave'}
              </Button>
            </Group>
          </Grid.Col>
        </Grid>

        <Grid>
          <Grid.Col span={6}>
            <Card shadow="sm" padding="lg">
              <Card.Section>
                <Video
                  ref={myVideoRef}
                  autoPlay
                  muted
                  playsInline
                  filter={myStreamFilter}
                  style={{
                    width: '100%',
                    cursor:
                      peerConnectionState === 'connected' ? 'pointer' : 'auto',
                  }}
                  onClick={onMyVideoClick}
                />
              </Card.Section>

              <Text weight={500} size="lg">
                My Stream
              </Text>

              <Text size="sm" style={{ display: 'flex', alignItems: 'center' }}>
                {isPolite ? (
                  <>
                    <StarFilledIcon />
                    <div>I am polite</div>
                  </>
                ) : (
                  <>
                    <StarIcon />
                    <div>I am impolite</div>
                  </>
                )}
              </Text>
            </Card>
          </Grid.Col>
          <Grid.Col span={6}>
            <Card shadow="sm" padding="lg">
              <Card.Section>
                <Video
                  ref={peerVideoRef}
                  autoPlay
                  muted
                  playsInline
                  style={{ width: '100%' }}
                  filter={peerStreamFilter}
                />
              </Card.Section>

              <Text weight={500} size="lg">
                Peer stream
              </Text>
            </Card>
          </Grid.Col>
        </Grid>
      </Grid.Col>
      <Grid.Col span={6}>
        <div style={{ height: '100%' }}>
          <Grid grow>
            <Grid.Col span={12}>
              <List spacing="xs" size="sm" center>
                {messages.map(({ sender, message }, index) => (
                  <List.Item
                    icon={
                      <ThemeIcon size={24} radius="xl">
                        <Avatar
                          color={sender === 'me' ? 'red' : 'cyan'}
                          radius="xl"
                          size={24}
                        >
                          {sender}
                        </Avatar>
                      </ThemeIcon>
                    }
                    key={index}
                  >
                    {message}
                  </List.Item>
                ))}
              </List>
            </Grid.Col>
            <Grid.Col>
              <form onSubmit={form.onSubmit(onSubmit)}>
                <Group>
                  <TextInput
                    icon={<ChatBubbleIcon />}
                    placeholder="Enter message"
                    {...form.getInputProps('message')}
                  ></TextInput>
                  <Button
                    type="submit"
                    disabled={form.values.message.length < 1}
                  >
                    Send
                  </Button>
                </Group>
              </form>
            </Grid.Col>
          </Grid>
        </div>
      </Grid.Col>
    </Grid>
  );
};

export default Page;
