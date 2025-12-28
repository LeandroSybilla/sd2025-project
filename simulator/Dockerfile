# Usar a imagem base do Python
FROM python:3.9-slim

# Copiar requirements e instalar dependências
COPY requirements.txt /app/requirements.txt
RUN pip install -r /app/requirements.txt

# Copiar o código do simulador
WORKDIR /app
COPY trail_route.gpx /app/trail_route.gpx
COPY simulator.py /app/simulator.py

# Comando para iniciar o simulador
CMD ["python", "simulator.py"]