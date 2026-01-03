import { WebSocketServer } from 'ws';
import RabbitMQ from 'amqplib';
import _ from 'lodash';

const socketList = {};
const rabbitMqUrl = `amqp://${process.env.RABBIT_USER}:${process.env.RABBIT_PASS}@${process.env.RABBIT_URL}:${process.env.RABBIT_PORT}`;

const server = new WebSocketServer({ port: 8000 });

server.on('connection', (socket, req) => {
  console.log('Client connected');
  const url = new URL(`http://${process.env.HOST ?? 'localhost'}${req.url}`);

  const trail = url?.searchParams?.get('trail') ? url?.searchParams?.get('trail') : 'default';
  const athlete = url?.searchParams?.get('athlete') ? url?.searchParams?.get('athlete') : 'all';

  _.set(socketList, `${trail}.${athlete}`, socket);

  socket.on('close', () => {
    console.log('Client disconnected');
  });
});

console.log('WebSocket server is running on port 8000');

const do_consume = async (queue) => {
  const conn = await RabbitMQ.connect(rabbitMqUrl, "heartbeat=60");
  const channel = await conn.createChannel()
  const queueName = 'group6';
  await conn.createChannel();
  await channel.assertQueue(queueName, {durable: false});
  await channel.consume(queueName, async (msg) => {
    if (msg !== null) {
      console.log(msg.content);
      for await (const socket of socketList) {
        await socket.send(msg.content.toString());
      }
      channel.ack(msg);
    } else {
      console.log('Consumer cancelled by server');
    }
  });
}

(async () => {
  // do_consume('default');
  // do_consume('madeira_crossing');
  // do_consume('pr9');
  // do_consume('pr13');
})();