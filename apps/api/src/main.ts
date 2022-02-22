import * as express from 'express';
import * as https from 'https';
import * as fs from 'fs';
import { Server } from 'socket.io';
import {
  PEER_CONNECTED_EVENT,
  PEER_DISCONNECTED_EVENT,
  SIGNAL_EVENT,
} from '@programming-webrtc/shared';

const app = express();
const hostname = 'localhost';
const appOrigin = process.env.NX_APP_ORIGIN;
const port = process.env.port || 3333;

app.get('/api', (req, res) => {
  res.send({ message: 'Welcome to api!' });
});

let server = null;

if (process.env.NX_SSL_KEY_PATH && process.env.NX_SSL_CERT_PATH) {
  https.createServer({});

  const httpsOptions = {
    key: fs.readFileSync('./cert/localhost.key'),
    cert: fs.readFileSync('./cert/localhost.crt'),
  };

  server = https.createServer(httpsOptions, app).listen(port, () => {
    console.log(`Listening at https://${hostname}:${port}/api`);
  });
} else {
  server = app.listen(port, () => {
    console.log(`Listening at http://${hostname}:${port}/api`);
  });
}

server.on('error', console.error);

const io = new Server(server, {
  cors: {
    origin: appOrigin,
  },
});

// Namespace pattern xxxxx-xxxxx
const namespace = io.of(/^\/[a-z]{2,}-[a-z]{2,}$/);
namespace.on('connect', (socket) => {
  const { name } = socket.nsp;
  console.log('Socket nsp.name:', name);
  console.log('Socket id:', socket.id);

  socket.broadcast.emit(PEER_CONNECTED_EVENT);

  socket.on(SIGNAL_EVENT, (data) => {
    console.log('signal_event: ', data);
    socket.broadcast.emit(SIGNAL_EVENT, data);
  });

  socket.on('disconnect', (reason) => {
    console.log('disconnect:', reason);
    namespace.emit(PEER_DISCONNECTED_EVENT);
  });
});
