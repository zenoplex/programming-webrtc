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

interface FileMetaData {
  type: string;
  name: string;
  size: number;
}

type Message =
  | {
      sender: string;
      type: 'text';
      text: string;
      timestamp: number;
      hasBeenReadByPeer: boolean;
    }
  | {
      sender: string;
      type: 'image';
      timestamp: number;
      metadata: FileMetaData;
      file: File | Blob;
      hasBeenReadByPeer: boolean;
    };

interface MessageResponse {
  id: number;
  timestamp: number;
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
  // Should store message as dictionary rather than array for performance reason
  const [messages, setMessages] = useState<Message[]>([]);
  const messageQueue = useRef<(Message | MessageResponse)[]>([]);

  const form = useForm({
    initialValues: { text: '' },
  });
  const onSubmit = useCallback(
    async (values: { text: string }) => {
      const message = {
        sender: 'me',
        type: 'text' as const,
        text: values.text,
        timestamp: Date.now(),
        hasBeenReadByPeer: false,
      };
      setMessages((s) => [...s, message]);
      // TODO: fix page style to cap height and add scrollTo
      if (
        peerChatChannel.current &&
        peerChatChannel.current.readyState === 'open'
      ) {
        const chatChannel = peerChatChannel.current;

        try {
          chatChannel.send(JSON.stringify(message));
        } catch (err) {
          console.error('Failed to send message', err);
          messageQueue.current.push(message);
        }
      } else {
        messageQueue.current.push(message);
      }

      form.setFieldValue('text', '');
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

        e.channel.onopen = () => {
          e.channel.close();
        };
      }
      if (label.startsWith('IMAGE-')) {
        const chunks: ArrayBuffer[] = [];
        let metadata: FileMetaData & { timestamp: number };
        let bytesReceived = 0;
        // TODO: type message data
        e.channel.onmessage = (event: MessageEvent<string | ArrayBuffer>) => {
          // Metadata
          if (typeof event.data === 'string') {
            metadata = JSON.parse(event.data);
          } else {
            bytesReceived += event.data.byteLength;
            chunks.push(event.data);
            if (bytesReceived === metadata.size) {
              const image = new Blob(chunks, { type: metadata.type });

              setMessages((s) => [
                ...s,
                {
                  sender: 'peer',
                  type: 'image' as const,
                  file: image,
                  metadata,
                  hasBeenReadByPeer: false,
                  timestamp: Date.now(),
                },
              ]);

              const response = {
                id: metadata.timestamp,
                timestamp: Date.now(),
              };

              try {
                e.channel.send(JSON.stringify(response));
              } catch (err) {
                messageQueue.current.push(response);
              }
            }
          }
        };
      }
    };

    const addStreamingMedia = (peer: RTCPeerConnection) => {
      if (myStream.current) {
        for (const track of myStream.current.getTracks()) {
          peer.addTrack(track, myStream.current);
        }
      }
    };

    const addChatChannel = (peer: RTCPeerConnection) => {
      console.log('addChatChannel', peer);
      const chatChannel = peer.createDataChannel('CHAT', {
        negotiated: true,
        id: 51,
      });

      chatChannel.onopen = () => {
        console.log('Chat channel open.');
        chatChannel.send(
          JSON.stringify({ sender: 'me', text: 'Hi', timestamp: Date.now() })
        );

        // Send queued messages and clear the queue
        messageQueue.current.forEach((message) => {
          chatChannel.send(JSON.stringify(message));
        });
        messageQueue.current = [];
      };
      chatChannel.onmessage = (e: MessageEvent<string>) => {
        const message = JSON.parse(e.data) as Message | MessageResponse;

        if (!('id' in message)) {
          setMessages((s) => [
            ...s,
            {
              ...message,
              sender: 'peer',
            },
          ]);

          // Create and send message response
          const response: MessageResponse = {
            id: message.timestamp,
            timestamp: Date.now(),
          };

          try {
            chatChannel.send(JSON.stringify(response));
          } catch (err) {
            messageQueue.current.push(response);
          }
        } else {
          setMessages((s) =>
            s.map((item) => {
              if (item.timestamp === message.id) {
                item.hasBeenReadByPeer = true;
              }
              return item;
            })
          );
        }
      };
      chatChannel.onclose = (e: Event) => {
        console.log('Chat channel closed.', e);
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
      newRpc.onconnectionstatechange = onConnectionStateChange;
      newRpc.ondatachannel = onDataChannel;
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
            console.log('remote description', description);
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
      // Reset to default state
      isPolite.current = false;
    } else {
      socket?.open();
    }
  }, [isSocketConnected, socket]);

  const onFileButtonClick = useCallback(() => {
    const input =
      document.querySelector<HTMLInputElement>('input.TEMP') ||
      document.createElement('input');
    input.className = 'TEMP';
    input.type = 'file';
    input.accept = '.gif,.jpg,.jpeg,.png';
    input.setAttribute('aria-hidden', 'true');
    input.onchange = async (e) => {
      if (!(e.target instanceof HTMLInputElement)) return;

      const file = e.target.files?.[0];
      if (!file) return;

      const metadata = {
        type: file.type,
        name: file.name,
        size: file.size,
      };

      const message = {
        sender: 'me',
        type: 'image' as const,
        metadata,
        file,
        timestamp: Date.now(),
        hasBeenReadByPeer: false,
      };

      setMessages((s) => [...s, message]);
      e.target.remove();

      if (peer.current && peer.current.connectionState === 'connected') {
        const rtc = peer.current;
        const dataChannel = rtc.createDataChannel(`IMAGE-${metadata.name}`);
        const chunk = 8 * 1024;
        dataChannel.onopen = async () => {
          dataChannel.binaryType = 'arraybuffer';
          // adding timestamp since receiver need to send response based on timestamp
          dataChannel.send(
            JSON.stringify({ ...metadata, timestamp: message.timestamp })
          );
          const data = await file.arrayBuffer();
          for (let i = 0; i < metadata.size; i += chunk) {
            dataChannel.send(data.slice(i, i + chunk));
          }
        };
        dataChannel.onmessage = (e: MessageEvent<string>) => {
          const data: MessageResponse = JSON.parse(e.data);
          setMessages((s) =>
            s.map((item) => {
              if (item.timestamp === data.id) {
                item.hasBeenReadByPeer = true;
              }
              return item;
            })
          );
          dataChannel.close();
        };
      } else {
        messageQueue.current.push(message);
      }
    };
    document.body.appendChild(input);
    input.click();
  }, []);

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
                {messages.map((msg, index) => {
                  return (
                    <List.Item
                      icon={
                        <ThemeIcon size={24} radius="xl">
                          <Avatar
                            color={msg.sender === 'me' ? 'red' : 'cyan'}
                            radius="xl"
                            size={24}
                          >
                            {msg.sender}
                          </Avatar>
                        </ThemeIcon>
                      }
                      key={index}
                    >
                      {msg.sender === 'me' && (
                        <Text size="xs" color="darkgray">
                          {msg.hasBeenReadByPeer ? 'read' : 'not read'}
                        </Text>
                      )}
                      {msg.type === 'text' && <div>{msg.text}</div>}
                      {msg.type === 'image' && (
                        <img
                          src={URL.createObjectURL(msg.file)}
                          alt={msg.metadata.name}
                          onLoad={(e) => {
                            URL.revokeObjectURL(e.currentTarget.src);
                          }}
                        />
                      )}
                    </List.Item>
                  );
                })}
              </List>
            </Grid.Col>
            <Grid.Col>
              <form onSubmit={form.onSubmit(onSubmit)}>
                <Group>
                  <TextInput
                    icon={<ChatBubbleIcon />}
                    placeholder="Enter message"
                    {...form.getInputProps('text')}
                  ></TextInput>
                  <Button type="submit" disabled={form.values.text.length < 1}>
                    Send
                  </Button>
                  <Button onClick={onFileButtonClick}>image</Button>
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
