create table if not exists public.app_documents (
  collection text not null,
  id text not null,
  document jsonb not null default '{}'::jsonb,
  inserted_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (collection, id)
);

create index if not exists idx_app_documents_collection
  on public.app_documents (collection);

create index if not exists idx_app_documents_document_gin
  on public.app_documents
  using gin (document jsonb_path_ops);

create or replace function public.set_app_documents_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists trg_app_documents_updated_at on public.app_documents;

create trigger trg_app_documents_updated_at
before update on public.app_documents
for each row
execute function public.set_app_documents_updated_at();

insert into storage.buckets (id, name, public)
values ('app-assets', 'app-assets', false)
on conflict (id) do nothing;
