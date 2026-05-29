create table public.otp_codes (
  id uuid default gen_random_uuid() primary key,
  email text not null,
  code text not null,
  created_at timestamp with time zone default now() not null,
  expires_at timestamp with time zone not null,
  used boolean default false not null
);

create index idx_otp_codes_email on public.otp_codes(email);
create index idx_otp_codes_expires_at on public.otp_codes(expires_at);

-- Add simple RLS: Enable RLS but don't add any policies,
-- which effectively means only service_role can access this table.
alter table public.otp_codes enable row level security;
