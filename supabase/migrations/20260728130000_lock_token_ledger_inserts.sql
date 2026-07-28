-- token_ledger writes must only come from SECURITY DEFINER RPCs / service_role.
-- The authenticated INSERT policy let users forge their own billing-history rows
-- (balance was never affected). Drop it; keep SELECT-own.

drop policy if exists "Users can insert own ledger entries" on public.token_ledger;
