# Usar a imagem base do Python
FROM python:3.9-slim

# Instalar dependências
RUN pip install requests gpxpy
RUN pip install pika --upgrade
RUN pip install prometheus_client
# Copiar o código do simulador
WORKDIR /app
COPY trail_route.gpx /app/trail_route.gpx
COPY madeira_crossing.gpx /app/madeira_crossing.gpx
COPY pr9_madeira.gpx /app/pr9_madeira.gpx
COPY pr13_madeira.gpx /app/pr13_madeira.gpx

COPY simulator.py /app/simulator.py

# Comando para iniciar o simulador
CMD ["python", "simulator.py"]