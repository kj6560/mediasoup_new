const fs = require('fs');
const https = require('https');
const WebSocket = require('ws');
const path = require('path')
const config = require('./config')
const { handleSocket } = require('./socket');
const { initializeWorkers } = require('./worker');
const options = {
  key: fs.readFileSync('../../../../../etc/letsencrypt/live/drrksuri.com/privkey.pem', 'utf-8'),
  cert: fs.readFileSync('../../../../../etc/letsencrypt/live/drrksuri.com/cert.pem', 'utf-8')
}


const httpsServer = https.createServer(options);

const wss = new WebSocket.Server({
  maxPayload: 200000000,
  server: httpsServer
}, () => console.log('WebSocket.Server started at port 8080'));

const noop = () => {};

function heartbeat () {
  this.isAlive = true;
}

(async () => {
  try {
    await initializeWorkers();

    httpsServer.listen(3001, () =>
      console.log('websocket SSL server running on port 3001')
    );
  } catch (error) {
    console.error('Failed to initialize workers [error:%o]', error);
  }
})();

wss.on('connection', socket => {
  socket.isAlive = true;
  socket.on('pong', heartbeat);

  // Decorate socket
  socket.broadcast = (message) => {
    for (const client of wss.clients) {
      //if (client !== socket && client.readyState === WebSocket.OPEN) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(message));
      }
    }
  };

  socket.emitToSocket = (socketId, message) => {
    const client = Array.from(wss.clients).find(client => client.id === socketId);

    if (!client) {
      console.error('Failed to find client with id %s', socketId);
      return;
    }

    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(message));
    }
  };

  handleSocket(socket);
});

const interval = setInterval(() => {
  /*
  for (const client of wss.clients) {
    if (!client.isAlive) {
      return client.terminate();
    }

    client.isAlive = false;
    client.ping(noop);
  }
  */
}, 3000);
