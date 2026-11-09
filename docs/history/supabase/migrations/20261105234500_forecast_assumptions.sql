-- A saved forecast keeps the plan conditions that produced it. Later edits to
-- recurring_plans do not rewrite this copy. Forecasts saved before the column
-- existed remain explainable only by their plan identifiers.
alter table public.forecasts
  add column assumptions jsonb not null default '[]'::jsonb;

alter table public.forecasts
  add constraint forecasts_assumptions_array_chk check (jsonb_typeof(assumptions) = 'array');

comment on column public.forecasts.assumptions is
  'Copy of the recurring-plan conditions used when the forecast was calculated.';
