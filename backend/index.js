import { WebSocketServer } from 'ws';
import RabbitMQ from 'amqplib';
import express from 'express';
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

const socketList = [];
const rabbitMqUrl = `amqp://${process.env.RABBIT_USER}:${process.env.RABBIT_PASS}@${process.env.RABBIT_URL}:${process.env.RABBIT_PORT}/${process.env.RABBIT_VHOST}`;

const server = new WebSocketServer({ port: 8000 });

server.on('connection', (socket) => {
  console.log('Client connected');
  socketList.push(socket);
  
  socket.on('message', (message) => {
    console.log(`Received: ${message}`);
    socket.send(`Server: ${message}`);
  });

  socket.on('close', () => {
    console.log('Client disconnected');
  });
});

console.log('WebSocket server is running on port 8000');

const do_consume = async () => {
  const conn = await RabbitMQ.connect(rabbitMqUrl, "heartbeat=60");
  const channel = await conn.createChannel()
  const queueName = 'grupo6';
  await conn.createChannel();
  await channel.assertQueue(queueName, {durable: false});
  await channel.consume(queueName, async (msg) => {
    if (msg !== null) {
      for await (const socket of socketList) {
        await socket.send(msg.content.toString());
      }
    }
  });
}

(async () => {
  do_consume();
})();