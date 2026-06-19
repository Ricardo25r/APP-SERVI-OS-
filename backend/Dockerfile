# Backend FazTudo — imagem de produção/dev.
FROM python:3.12-slim

# Configurações de runtime do Python.
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

# Dependências de sistema mínimas (build de wheels nativas, ex.: asyncpg/bcrypt).
RUN apt-get update \
    && apt-get install -y --no-install-recommends build-essential libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Instala dependências Python primeiro (melhor cache de camadas).
COPY requirements.txt ./
RUN pip install --upgrade pip && pip install -r requirements.txt

# Copia o código da aplicação.
COPY . .

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
