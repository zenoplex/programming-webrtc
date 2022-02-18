import * as express from 'express';
import * as https from 'https';
import * as fs from 'fs';
import { Server } from 'socket.io';

const app = express();
const hostname = process.env.HOSTNAME || 'localhost';
const port = process.env.port || 3333;
const io = new Server();

const namespace = io.of('test');
namespace.on('connect', (socket) => {
  const { name } = socket.nsp;
  console.log('Socket nsp.name:', name);
  console.log('Socket id:', socket.id);

  socket.broadcast.emit('connected peer');

  socket.on('signal', (data) => {
    socket.broadcast.emit('signal', data);
  });

  socket.on('disconnect', () => {
    namespace.emit('disconnected peer');
  });
});

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
