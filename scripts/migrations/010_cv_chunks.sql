-- 010_cv_chunks.sql — the retrieval index over a user's own record.
--
-- Run in the Supabase SQL editor, like every migration in this directory.
--
-- What this is for: the letter and the CV are currently written from the WHOLE
-- master CV, the same ~10,000 characters for every job. This table holds that
-- record cut into pieces (utils/cv-chunks.js) with an embedding each, so a job
-- ad's requirements can be matched against the pieces that actually answer them.
--
-- Nothing about a job ad is stored. The ad is embedded at request time, used for
-- one search, and discarded — it is a query, not data.

create extension if not exists vector;

create table if not exists cv_chunks (
  id          bigserial primary key,
  user_id     text not null,
  chunk_id    text not null,               -- stable id from chunkMaster(), content-derived
  kind        text not null,               -- role | role-summary | engagement | advisory | speaking | publication
  source      text not null,               -- where in the record it came from, for provenance
  header      text not null default '',
  text        text not null,
  embedding   vector(768),                 -- Gemini text-embedding-004 / gemini-embedding-001 default width
  updated_at  timestamptz not null default now(),
  unique (user_id, chunk_id)
);

create index if not exists cv_chunks_user_idx on cv_chunks (user_id);

-- Cosine distance, IVFFlat. lists=100 is the pgvector default guidance for small
-- tables; one user's record is on the order of 100 rows, so this is well within
-- the range where an exact scan would also be fine — the index is here so it
-- stays fast if the corpus grows.
create index if not exists cv_chunks_embedding_idx
  on cv_chunks using ivfflat (embedding vector_cosine_ops) with (lists = 100);

-- Retrieval. Called once per requirement with that requirement's embedding.
-- user_id is passed by the server from the verified session, never from a body.
create or replace function match_cv_chunks(
  p_user_id text,
  p_embedding vector(768),
  p_limit int default 5
)
returns table (
  chunk_id text,
  kind text,
  source text,
  header text,
  text text,
  similarity float
)
language sql stable
as $$
  select
    c.chunk_id,
    c.kind,
    c.source,
    c.header,
    c.text,
    1 - (c.embedding <=> p_embedding) as similarity
  from cv_chunks c
  where c.user_id = p_user_id
    and c.embedding is not null
  order by c.embedding <=> p_embedding
  limit p_limit;
$$;

-- Service-role only, like every other write path in this app. No anon access:
-- the chunks are a person's full career record.
alter table cv_chunks enable row level security;
