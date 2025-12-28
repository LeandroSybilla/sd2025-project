from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Response
from fastapi.middleware.cors import CORSMiddleware
import asyncio
import time
from prometheus_client import Counter, Histogram, generate_latest, CONTENT_TYPE_LATEST

app = FastAPI()

# Metrics
POSITIONS_PROCESSED_TOTAL = Counter('posiciones_procesadas_total', 'Total number of positions processed.')
PROCESSING_LATENCY_SECONDS = Histogram('latencia_procesamiento_segundos', 'Processing latency for events (in seconds).')

@app.get("/metrics")
def metrics():
    return Response(content=generate_latest(), media_type=CONTENT_TYPE_LATEST)

# Allow CORS for the frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# List to store active WebSocket connections
connections = []

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

@app.post("/events")
async def receive_event(event: dict):
    start_time = time.time()
    # Send the event to all active WebSocket connections
    disconnected_connections = []
    print(f"Broadcasting event: {event}")
    for connection in connections:
        try:
            await connection.send_json(event)
        except RuntimeError as e:
            # Handle cases where the connection is already closed
            print(f"Error sending to WebSocket: {e}")
            disconnected_connections.append(connection)

    # Remove disconnected WebSocket connections
    for connection in disconnected_connections:
        connections.remove(connection)

    # Update metrics
    POSITIONS_PROCESSED_TOTAL.inc()
    PROCESSING_LATENCY_SECONDS.observe(time.time() - start_time)

    return {"status": "event sent"}