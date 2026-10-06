-- Manual application only. This file is not executed by the application.
-- SECURITY DEFINER intentionally aggregates private votes under a trusted owner.
-- Assumes every generation is public under the current publication model.
-- Revisit this function before adding private/draft/moderated generations.
-- Verify the postgres owner can read all vote rows under the live RLS setup.
begin;

create function public.get_public_feed(
  p_sort text default 'new',
  p_limit integer default 13,
  p_offset integer default 0
)
returns table (
  id uuid,
  caption text,
  created_at timestamptz,
  score bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_sort is null or p_sort not in ('new', 'hot') then
    raise exception 'Invalid feed sort'
      using errcode = '22023';
  end if;

  if p_limit is null or p_limit < 1 or p_limit > 13
     or p_offset is null or p_offset < 0
     or p_offset > 12000000 then
    raise exception 'Invalid feed pagination'
      using errcode = '22023';
  end if;

  return query
  with scored as (
    select
      g.id,
      g.caption,
      g.created_at,
      coalesce(sum(v.value), 0::bigint) as score
    from public.generations as g
    left join public.votes as v
      on v.generation_id = g.id
    group by g.id, g.caption, g.created_at
  )
  select
    s.id,
    s.caption,
    s.created_at,
    s.score
  from scored as s
  order by
    case when p_sort = 'hot' then
      s.score::numeric
      - greatest(
          0::numeric,
          extract(epoch from (now() - s.created_at)) / 86400
        )
    end desc,
    s.created_at desc,
    s.id desc
  limit p_limit
  offset p_offset;
end;
$$;

alter function public.get_public_feed(text, integer, integer)
  owner to postgres;

revoke all on function
  public.get_public_feed(text, integer, integer)
  from public, anon, authenticated;

grant execute on function
  public.get_public_feed(text, integer, integer)
  to anon, authenticated;

commit;
