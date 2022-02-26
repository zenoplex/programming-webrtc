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
  createStyles,
} from '@mantine/core';
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

const streamFilters = [undefined, 'grayscale' , 'sepia' , 'noir' , 'psychedelic'] as const

const Page = () => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isSocketConnected, setIsSocketConnected] = useState(false);
  const [peerConnectionState, setPeerConnectionState] = useState<RTCPeerConnectionState | undefined>();
  const [roomId, setRoomId] = useState(randGitBranch());
  const [myStreamFilter, setMyStreamFilter] = useState<typeof streamFilters[number]>();
  const [peerStreamFilter, setPeerStreamFilter] = useState<typeof streamFilters[number]>();
  const isPolite = useRef(false);
  const isMakingOffer = useRef(false);
  const isIgnoringOffer = useRef(false);
  const isSettingRemoteAnswerPending = useRef(false);
  const peer = useRef<RTCPeerConnection | null>(null);
  const myStream = useRef<MediaStream | null>(null);
  const myVideoRef = useRef<HTMLVideoElement | null>(null);
  const peerVideoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const apiOrigin = process.env.NX_API_ORIGIN;
    const sc = io(`${apiOrigin}/${roomId}`, { autoConnect: false });
    sc.on('connect', () => {
      console.log('connect');
      setIsSocketConnected(true);
    });

    const onNegotiationNeeded = async () => {
      if (!peer.current) return;
      console.log('onNegotiationNeeded');

      const rpc = peer.current;
      isMakingOffer.current = true;
      const offer = await rpc.createOffer();
      await rpc.setLocalDescription(offer);
      sc.emit(SIGNAL_EVENT, { description: rpc.localDescription });
      isMakingOffer.current = false;
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
    }

    const onDataChannel = (e: RTCDataChannelEvent) => {
      console.log('onDataChannel', e);
      const label = e.channel.label;
      if (label.startsWith('FILTER-')){
        const filter = label.replace('FILTER-','');
        setPeerStreamFilter(filter as typeof streamFilters[number]);
      }
    }

    const addStreamingMedia = (peer: RTCPeerConnection) => {
      if (myStream.current) {
        for (const track of myStream.current.getTracks()) {
          peer.addTrack(track, myStream.current);
        }
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
        console.log('SIGNAL_EVENT', { description, candidate });

        if (!peer.current) return;
        const rpc = peer.current;

        // offer/answer
        if (description) {
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
          console.log('description', description);
          await rpc.setRemoteDescription(description);
          isSettingRemoteAnswerPending.current = false;

          // Has to respond to remote peer's offer
          if (description.type === 'offer') {
            const answer = await rpc.createAnswer();
            console.log('answer', answer);
            await rpc.setLocalDescription(answer);
            sc.emit('signal', { description: rpc.localDescription });
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
    if (myVideoRef.current && peer.current && peerConnectionState === 'connected') {
      const currentFilterIndex = streamFilters.indexOf(myStreamFilter);
      const nextFilter = streamFilters[(currentFilterIndex + 1) % streamFilters.length];
      setMyStreamFilter(nextFilter);

      const label = `FILTER-${nextFilter}`;
      const dataChannel = peer.current.createDataChannel(label)
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
                  style={{ width: '100%', cursor: peerConnectionState === 'connected' ? 'pointer' : 'auto' }}
                  onClick={onMyVideoClick}
                />
              </Card.Section>

              <Text weight={500} size="lg">
                You've won a million dollars in cash!
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
