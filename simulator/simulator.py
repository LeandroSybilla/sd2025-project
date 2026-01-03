import json
import gpxpy
import gpxpy.gpx
import time
import random
import pika
import os

# Configuration
TRAILS = {
    "default": { "name": "Default", "queue": "group6_default", "file": "trail_route.gpx", "maxAthetes": 30},
    "madeira_crossing": { "name": "Madeira Crossing", "queue": "group6_madeira_crossing", "file": "madeira_crossing.gpx", "maxAthetes": 10 },
    "pr9": { "name": "PR9 - Levada do Caldeirão", "queue": "group6_pr9", "file": "pr9_madeira.gpx", "maxAthetes": 8 },
    "pr13": { "name": "PR13 - Vereda do Fanal", "queue": "group6_pr13", "file": "pr13_madeira.gpx", "maxAthetes": 5 }
}

ATHLETES = [
    {"name": "John Smith", "gender": "male"},
    {"name": "Jane Smith", "gender": "female"},
    {"name": "Michael Johnson", "gender": "male"},
    {"name": "Emily Johnson", "gender": "female"},
    {"name": "David Brown", "gender": "male"},
    {"name": "Sarah Brown", "gender": "female"},
    {"name": "James Taylor", "gender": "male"},
    {"name": "Laura Taylor", "gender": "female"},
    {"name": "Robert Anderson", "gender": "male"},
    {"name": "Emma Anderson", "gender": "female"},
    {"name": "William Thomas", "gender": "male"},
    {"name": "Olivia Thomas", "gender": "female"},
    {"name": "Daniel Jackson", "gender": "male"},
    {"name": "Sophia Jackson", "gender": "female"},
    {"name": "Joseph White", "gender": "male"},
    {"name": "Isabella White", "gender": "female"},
    {"name": "Charles Harris", "gender": "male"},
    {"name": "Mia Harris", "gender": "female"},
    {"name": "Thomas Martin", "gender": "male"},
    {"name": "Charlotte Martin", "gender": "female"},
    {"name": "Christopher Thompson", "gender": "male"},
    {"name": "Amelia Thompson", "gender": "female"},
    {"name": "Matthew Garcia", "gender": "male"},
    {"name": "Grace Garcia", "gender": "female"},
    {"name": "Anthony Martinez", "gender": "male"},
    {"name": "Hannah Martinez", "gender": "female"},
    {"name": "Mark Robinson", "gender": "male"},
    {"name": "Abigail Robinson", "gender": "female"},
    {"name": "Paul Clark", "gender": "male"},
    {"name": "Ella Clark", "gender": "female"},
    {"name": "Steven Lewis", "gender": "male"},
    {"name": "Avery Lewis", "gender": "female"},
    {"name": "Andrew Lee", "gender": "male"},
    {"name": "Scarlett Lee", "gender": "female"},
    {"name": "Joshua Walker", "gender": "male"},
    {"name": "Lily Walker", "gender": "female"},
    {"name": "Kevin Hall", "gender": "male"},
    {"name": "Zoey Hall", "gender": "female"},
    {"name": "Brian Young", "gender": "male"},
    {"name": "Penelope Young", "gender": "female"},
    {"name": "Justin Allen", "gender": "male"},
    {"name": "Riley Allen", "gender": "female"},
    {"name": "Ryan King", "gender": "male"},
    {"name": "Nora King", "gender": "female"},
    {"name": "Brandon Wright", "gender": "male"},
    {"name": "Chloe Wright", "gender": "female"},
    {"name": "Eric Lopez", "gender": "male"},
    {"name": "Victoria Lopez", "gender": "female"},
    {"name": "Adam Hill", "gender": "male"},
    {"name": "Madison Hill", "gender": "female"},
    {"name": "Jason Scott", "gender": "male"},
    {"name": "Aria Scott", "gender": "female"},
    {"name": "Aaron Green", "gender": "male"},
    {"name": "Layla Green", "gender": "female"},
    {"name": "Kyle Adams", "gender": "male"},
    {"name": "Zoe Adams", "gender": "female"},
    {"name": "Nathan Baker", "gender": "male"},
    {"name": "Stella Baker", "gender": "female"},
    {"name": "Sean Gonzalez", "gender": "male"},
    {"name": "Hazel Gonzalez", "gender": "female"},
    {"name": "Patrick Nelson", "gender": "male"},
    {"name": "Audrey Nelson", "gender": "female"},
    {"name": "Ethan Carter", "gender": "male"},
    {"name": "Lucy Carter", "gender": "female"},
    {"name": "Christian Mitchell", "gender": "male"},
    {"name": "Paisley Mitchell", "gender": "female"},
    {"name": "Jonathan Perez", "gender": "male"},
    {"name": "Brooklyn Perez", "gender": "female"},
    {"name": "Zachary Roberts", "gender": "male"},
    {"name": "Savannah Roberts", "gender": "female"},
    {"name": "Dylan Turner", "gender": "male"},
    {"name": "Claire Turner", "gender": "female"},
    {"name": "Ian Phillips", "gender": "male"},
    {"name": "Anna Phillips", "gender": "female"},
    {"name": "Lucas Campbell", "gender": "male"},
    {"name": "Leah Campbell", "gender": "female"},
    {"name": "Jordan Parker", "gender": "male"},
    {"name": "Naomi Parker", "gender": "female"},
    {"name": "Connor Evans", "gender": "male"},
    {"name": "Elena Evans", "gender": "female"},
    {"name": "Tyler Edwards", "gender": "male"},
    {"name": "Sophie Edwards", "gender": "female"}
]

SPEED_VARIATION = (6, 12)  # Speed range in km/h for each athlete

# Function to read the GPX file
def read_gpx(file_path):
    with open(file_path, 'r') as gpx_file:
        gpx = gpxpy.parse(gpx_file)
    return gpx

# Function to simulate an athlete's movement along the trail
def simulate_athlete(athlete, points, speed_kmh, queue):
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
                "event": "running",
                "queue": queue
            }

            # Send the event to the backend
            try:
                credentials = pika.PlainCredentials(os.environ["RABBIT_USER"], os.environ["RABBIT_PASS"])
                connection = pika.BlockingConnection(pika.ConnectionParameters(os.environ["RABBIT_URL"], os.environ["RABBIT_PORT"], '/', credentials))
                channel = connection.channel()
                channel.queue_declare(queue=queue)
                channel.basic_publish(exchange='', routing_key=queue, body=json.dumps(event))
                connection.close()
                print(f"Sent: {event}")
            except Exception as e:
                print(f"Error sending event: {e}")

            # Wait for 1 second to simulate real-time updates
            time.sleep(1)

# Main function to simulate multiple athletes
def simulate_multiple_athletes(trail):
    # Selecting trail
    selected_trail = TRAILS[trail]

    # Read the GPX file
    gpx = read_gpx(selected_trail["file"])

    # Extract all points from the GPX file
    points = []
    for track in gpx.tracks:
        for segment in track.segments:
            points.extend(segment.points)

    trail_athletes = random.sample(ATHLETES, selected_trail["maxAthetes"])
    
    # Simulate each athlete in a separate thread
    from threading import Thread
    
    threads = []
    for athlete in trail_athletes:
        # Assign a random speed within the defined range
        speed_kmh = random.uniform(*SPEED_VARIATION)
        print(f"Simulating {athlete} at {speed_kmh:.2f} km/h")

        # Create a thread for the athlete
        thread = Thread(target=simulate_athlete, args=(athlete, points, speed_kmh, selected_trail["queue"]))
        threads.append(thread)
        thread.start()

    # Wait for all threads to finish
    for thread in threads:
        thread.join()

# Run the simulation
if __name__ == "__main__":
    simulate_multiple_athletes(os.environ["TRAIL_ID"])