import gpxpy
import gpxpy.gpx
import time
import random
import requests

# Configuration
INGESTION_ENDPOINT = "http://backend:8000/events"  # Update this if needed
GPX_FILE_PATH = "trail_route.gpx"  # Path to the GPX file
ATHLETES = [
    {"name": "John Doe", "gender": "male"},
    {"name": "Jane Smith", "gender": "female"},
    {"name": "Alice Johnson", "gender": "female"},
    {"name": "Bob Brown", "gender": "male"}
]
SPEED_VARIATION = (6, 12)  # Speed range in km/h for each athlete

# Function to read the GPX file
def read_gpx(file_path):
    with open(file_path, 'r') as gpx_file:
        gpx = gpxpy.parse(gpx_file)
    return gpx

# Function to simulate an athlete's movement along the trail
def simulate_athlete(athlete, points, speed_kmh):
    athlete_name = athlete["name"]
    athlete_gender = athlete["gender"]
    # Convert speed to meters per second
    speed_mps = speed_kmh / 3.6

    # Simulate movement between points
    for i in range(len(points) - 1):
        start = points[i]
        end = points[i + 1]

        # Calculate the distance between points (in meters)
        distance = start.distance_3d(end)

        # Calculate the time required to travel this segment (in seconds)
        duration = distance / speed_mps

        # Interpolate positions along the segment
        for t in range(int(duration)):
            fraction = t / duration
            lat = start.latitude + fraction * (end.latitude - start.latitude)
            lon = start.longitude + fraction * (end.longitude - start.longitude)
            ele = start.elevation + fraction * (end.elevation - start.elevation)

            # Create the event
            event = {
                "athlete": athlete_name,
                "gender": athlete_gender,
                "location": {"latitude": lat, "longitude": lon},
                "elevation": ele,
                "time": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                "event": "running"
            }

            # Send the event to the backend
            try:
                response = requests.post(INGESTION_ENDPOINT, json=event)
                print(f"Sent: {event} | Response: {response.status_code}")
            except Exception as e:
                print(f"Error sending event: {e}")

            # Wait for 1 second to simulate real-time updates
            time.sleep(1)

# Main function to simulate multiple athletes
def simulate_multiple_athletes():
    # Read the GPX file
    gpx = read_gpx(GPX_FILE_PATH)

    # Extract all points from the GPX file
    points = []
    for track in gpx.tracks:
        for segment in track.segments:
            points.extend(segment.points)

    # Simulate each athlete in a separate thread
    from threading import Thread

    threads = []
    for athlete in ATHLETES:
        # Assign a random speed within the defined range
        speed_kmh = random.uniform(*SPEED_VARIATION)
        print(f"Simulating {athlete} at {speed_kmh:.2f} km/h")

        # Create a thread for the athlete
        thread = Thread(target=simulate_athlete, args=(athlete, points, speed_kmh))
        threads.append(thread)
        thread.start()

    # Wait for all threads to finish
    for thread in threads:
        thread.join()

# Run the simulation
if __name__ == "__main__":
    simulate_multiple_athletes()