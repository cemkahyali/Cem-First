# syntax=docker/dockerfile:1
FROM python:3.11-slim

WORKDIR /app

# Önbellekten faydalanmak için önce sadece gereksinimleri kopyalayalım
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

ENV FLASK_APP=app
ENV FLASK_RUN_HOST=0.0.0.0
ENV PYTHONUNBUFFERED=1

EXPOSE 5000

CMD ["flask", "run", "--host", "0.0.0.0", "--port", "5000"]
