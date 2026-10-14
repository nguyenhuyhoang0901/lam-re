-- Chạy toàn bộ file này trong Supabase: SQL Editor > New query > Run.
-- Bảng lưu tiến trình, truy cập qua 2 hàm RPC (bảng không mở trực tiếp cho anon,
-- nên không ai liệt kê hay ghi đè hàng loạt được; chỉ ai biết mã lưu mới đọc/ghi được).

create table if not exists public.saves (
  code        text primary key,
  data        jsonb not null,
  updated_at  timestamptz not null default now()
);

alter table public.saves enable row level security;
revoke all on table public.saves from anon, authenticated;
-- Không tạo policy nào: anon/authenticated không đọc/ghi bảng trực tiếp được.

create or replace function public.put_save(p_code text, p_data jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_code !~ '^CHUOT-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$' then
    raise exception 'invalid code';
  end if;
  if octet_length(p_data::text) > 20000 then
    raise exception 'payload too large';
  end if;
  insert into public.saves (code, data, updated_at)
  values (p_code, p_data, now())
  on conflict (code) do update
    set data = excluded.data, updated_at = now();
end;
$$;

create or replace function public.get_save(p_code text)
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select data from public.saves where code = p_code;
$$;

revoke all on function public.put_save(text, jsonb) from public;
revoke all on function public.get_save(text) from public;
grant execute on function public.put_save(text, jsonb) to anon, authenticated;
grant execute on function public.get_save(text) to anon, authenticated;
