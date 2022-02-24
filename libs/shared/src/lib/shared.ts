import fetch from 'cross-fetch';
export const PEER_CONNECTED_EVENT = 'peer-connected';
export const PEER_DISCONNECTED_EVENT = 'peer-disconnected';
export const SIGNAL_EVENT = 'signal';
export const ICE_SERVERS_RECEIVED_EVENT = 'ice-servers-received';

type XirsysResponse =
  | {
      s: 'ok';
      v: {
        iceServers: { username: string; urls: string[]; credential: string };
      };
    }
  | {
      s: 'error';
      v: string;
    };

const defaultIceServers = [{ urls: 'stun2.l.google.com:19302' }];
export const getIceServers = async (
  turnServerOrigin: string | undefined,
  turnServerToken: string | undefined
): Promise<RTCIceServer[]> => {
  if (!turnServerOrigin || !turnServerToken) return defaultIceServers;

  try {
    const response = await fetch(turnServerOrigin, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${turnServerToken}`,
      },
      body: JSON.stringify({ format: 'urls' }),
    });
    const json = (await response.json()) as XirsysResponse;
    return json.s === 'ok' ? [json.v.iceServers] : defaultIceServers;
  } catch (e) {
    console.warn('Failed request to Xirsys turn api.', e);
    return defaultIceServers;
  }
};
