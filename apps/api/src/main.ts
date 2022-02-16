import * as express from 'express';
import * as https from 'https';
import * as fs from 'fs';

const app = express();
const hostname = process.env.HOSTNAME || 'localhost';
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
