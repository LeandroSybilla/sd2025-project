import uvicorn
from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import asyncio
import pika
import os

# List to store active WebSocket connections
connections = []

def receive_queue_event(ch, method, properties, body):
    print(f" [x] Received {body}")
    # Send the event to all active WebSocket connections
    disconnected_connections = []
    # print(f"Broadcasting event: {event}")
    for connection in connections:
        try:
            asyncio.get_event_loop().run_until_complete(connection.send_json(body))  
        except RuntimeError as e:
            # Handle cases where the connection is already closed
            print(f"Error sending to WebSocket: {e}")
            disconnected_connections.append(connection)

    # Remove disconnected WebSocket connections
    for connection in disconnected_connections:
        connections.remove(connection)

    return {"status": "event sent"}

@asynccontextmanager
async def lifespan(app: FastAPI):
   print('Testing startup')

app = FastAPI(lifespan=lifespan)

# Allow CORS for the frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# @app.on_event("startup")
# async def startup():
#     print(' [*] Connecting to Rabbit MQ ')
#     credentials = pika.PlainCredentials(os.environ["RABBIT_USER"], os.environ["RABBIT_PASS"])
#     connection = pika.BlockingConnection(pika.ConnectionParameters(os.environ["RABBIT_URL"], os.environ["RABBIT_PORT"], '/', credentials))
#     channel = connection.channel()
#     channel.queue_declare(queue='hello')
#     channel.basic_consume(queue='hello', auto_ack=True, on_message_callback=receive_queue_event)
#     # print(' [*] Waiting for messages. To exit press CTRL+C')
#     # channel.start_consuming()
#     # app.state.db = channel

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    connections.append(websocket)
    try:
        while True:
            # Keep the connection alive
            await asyncio.sleep(1)
    except WebSocketDisconnect:
        # Remove the connection when the client disconnects
        connections.remove(websocket)
        print("WebSocket client disconnected")

