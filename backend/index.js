import { WebSocketServer } from 'ws';
import RabbitMQ from 'amqplib';
import express from 'express';
import _ from 'lodash';
import client from 'prom-client';

// --- Prometheus Metrics Setup ---
const register = new client.Registry();
client.collectDefaultMetrics({ register });

const raceProcessedMessages = new client.Counter({
  name: 'race_processed_messages_total',
  help: 'Total number of race messages processed',
  labelNames: ['status'],
  registers: [register]
});

const raceProcessingDuration = new client.Histogram({
  name: 'race_processing_duration_seconds',
  help: 'Duration of message processing in seconds',
  buckets: [0.1, 0.5, 1, 2],
  registers: [register]
});

const raceActiveRunners = new client.Gauge({
  name: 'race_active_runners',
  help: 'Number of active runners detected',
  registers: [register]
});

const activeRunnersSet = new Set();

// Start Metrics Server
const metricsApp = express();
metricsApp.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

metricsApp.listen(9090, '0.0.0.0', () => {
  console.log('Metrics server running on port 9090');
});
// --------------------------------

const athletesPerTrail = {};
const socketList = {};

const rabbitMqUrl = `amqp://${process.env.RABBIT_USER}:${process.env.RABBIT_PASS}@${process.env.RABBIT_URL}:${process.env.RABBIT_PORT}/${process.env.RABBIT_VHOST}`;

const server = new WebSocketServer({ port: 8000 });

server.on('connection', (socket, req) => {
  console.log('Client connected');
  const url = new URL(`http://${process.env.HOST ?? 'localhost'}${req.url}`);

  const trail = url?.searchParams?.get('trail') ? url?.searchParams?.get('trail') : 'default';
  const athlete = url?.searchParams?.get('athlete') ? url?.searchParams?.get('athlete') : 'all';

  if ( _.isNil(_.get(socketList, `${trail}.${athlete}`))) {
    _.set(socketList, `${trail}.${athlete}`, []);
  }

  socketList[trail][athlete].push(socket);

  socket.on('close', () => {
    console.log('Client disconnected');
  });
});

console.log('WebSocket server is running on port 8000');

const do_consume = async (queue) => {
  console.log(`do_consume: ${queue}`);
  const conn = await RabbitMQ.connect(rabbitMqUrl, "heartbeat=60");
  const channel = await conn.createChannel()
  await channel.assertQueue(queue, {durable: false});
  await channel.consume(queue, async (msg) => {
    if (msg === null) return;

    const messageJson = JSON.parse(msg.content.toString());

    if (_.isEmpty(socketList) || _.isEmpty(socketList[messageJson.queue])) return;
    
    if (!_.isEmpty(socketList[messageJson.queue]['all'])) {
      for await (const socket of socketList[messageJson.queue]['all']) {
        await socket.send(msg.content.toString());
      }
    }

    if (!_.isEmpty(socketList[messageJson.queue][messageJson.athlete])) {
      for await (const socket of socketList[messageJson.queue][messageJson.athlete]) {
        await socket.send(msg.content.toString());
      }
    }

  });
}

(async () => {
  do_consume('group6_default');
  do_consume('group6_madeira_crossing');
  do_consume('group6_pr9');
  do_consume('group6_pr13');
})();