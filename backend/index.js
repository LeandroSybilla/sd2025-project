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
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5],
  registers: [register]
});

const raceActiveRunners = new client.Gauge({
  name: 'race_active_runners',
  help: 'Number of active runners detected across all trails (TTL filtered)',
  registers: [register]
});

const raceActiveRunnersByTrail = new client.Gauge({
  name: 'race_active_runners_by_trail',
  help: 'Number of active runners detected per trail (TTL filtered)',
  labelNames: ['trail'],
  registers: [register]
});

const ACTIVE_TTL_MS = Number(process.env.RACE_ACTIVE_TTL_MS ?? 180000); // default 3 minutes
const activeByTrail = {};

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
  const url = new URL(`http://${process.env.HOST ?? 'localhost'}${req.url}`);
  const trail = url?.searchParams?.get('trail') ? url?.searchParams?.get('trail') : 'default';
  const athlete = url?.searchParams?.get('athlete') ? url?.searchParams?.get('athlete') : 'all';

  console.log(`Client connected - Requesting ${trail} and data from ${athlete}`);

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
    const start = process.hrtime.bigint();
    let status = 'success';
    try {
      if (msg === null) return;

      const messageJson = JSON.parse(msg.content.toString());

      if (messageJson?.athlete) {
        const now = Date.now();
        const trailKey = messageJson.queue ?? 'default';

        if (_.isNil(activeByTrail[trailKey])) {
          activeByTrail[trailKey] = {};
        }

        activeByTrail[trailKey][messageJson.athlete] = now;

        let totalActive = 0;
        Object.entries(activeByTrail).forEach(([trail, athletes]) => {
          Object.entries(athletes).forEach(([athlete, lastSeen]) => {
            if (now - lastSeen > ACTIVE_TTL_MS) {
              delete activeByTrail[trail][athlete];
            }
          });

          const trailActiveCount = Object.keys(activeByTrail[trail]).length;
          raceActiveRunnersByTrail.set({ trail }, trailActiveCount);
          totalActive += trailActiveCount;
        });

        raceActiveRunners.set(totalActive);
      }

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
    } catch (err) {
      status = 'error';
      console.error('Failed to process message', err);
    } finally {
      const durationSec = Number(process.hrtime.bigint() - start) / 1e9;
      raceProcessingDuration.observe(durationSec);
      raceProcessedMessages.inc({ status });
      channel.ack(msg);
    }
  });
}
(async () => {
  do_consume('grupo6_default');
  do_consume('grupo6_madeira_crossing');
  do_consume('grupo6_pr9');
  do_consume('grupo6_pr13');
})();