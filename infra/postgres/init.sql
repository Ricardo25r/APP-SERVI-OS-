-- TrampoJá — init do PostgreSQL (executado apenas na primeira criação do volume)
-- Habilita extensões usadas pelo projeto.
--   uuid-ossp : geração de UUIDs
--   pg_trgm   : busca por similaridade / índices trigram
--   unaccent  : busca ignorando acentos (pt-BR)

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;
