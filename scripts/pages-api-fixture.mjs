// Loopback-only acceptance backend. Disconnect controls never enter production code.
import { createServer } from 'node:http';
import { createApp } from '../server/src/app.js';
import { openDatabase } from '../server/src/db/database.js';
const store = openDatabase();
const app = createApp({
  store,
  origin: 'http://127.0.0.1:3202',
  aiMode: 'demo',
});
let available = true;
const server = createServer((req, res) => {
  if (
    req.method === 'POST' &&
    ['/__test__/disconnect', '/__test__/connect'].includes(req.url)
  ) {
    available = req.url.endsWith('/connect');
    res.writeHead(204).end();
    return;
  }
  if (!available) {
    req.socket.destroy();
    return;
  }
  app(req, res);
});
server.listen(3301, '127.0.0.1', () =>
  console.log('Isolated API fixture http://127.0.0.1:3301'),
);
for (const signal of ['SIGINT', 'SIGTERM'])
  process.on(signal, () =>
    server.close(() => {
      store.close();
      process.exit(0);
    }),
  );
