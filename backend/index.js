import { WebSocketServer } from 'ws';
import RabbitMQ from 'amqplib';

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
      channel.ack(msg);
    } else {
      console.log('Consumer cancelled by server');
    }
  });
}

(async () => {
  do_consume();
})();