-- ============================================================
-- RETENCIÓN EFECTIVA: job diario de purga del bucket privado.
-- Convergente. Staging. NO aplicar a producción.
--
-- Todo ocurre dentro de la base: pg_cron dispara, `http` borra el objeto
-- del bucket con la clave de servicio leída del Vault, y recién si el
-- borrado terminó bien se marca la fila. La clave NUNCA sale a un cliente
-- ni queda en el código; el bucket sigue privado.
--
-- Idempotente: 404 del storage (el objeto ya no está) cuenta como purgado.
-- Reintentable: cualquier otro error deja la fila intacta para la próxima
-- corrida, y queda registrado en purga_ejecucion.
-- ============================================================

create extension if not exists pg_cron;
create extension if not exists http with schema extensions;

create table if not exists purga_ejecucion (
  id          bigserial primary key,
  corrida_en  timestamptz not null default now(),
  candidatas  int not null default 0,
  purgadas    int not null default 0,
  fallidas    int not null default 0,
  detalle     jsonb not null default '[]'::jsonb
);
alter table purga_ejecucion enable row level security;
drop policy if exists "purga_lectura_plataforma" on purga_ejecucion;
create policy "purga_lectura_plataforma" on purga_ejecucion
  for select using (es_plataforma());

create or replace function purgar_planillas_recepcion()
returns jsonb
language plpgsql security definer set search_path = public, extensions
as $$
declare
  v_url text; v_clave text; v_fila record;
  v_resp extensions.http_response; v_cand int := 0; v_ok int := 0; v_mal int := 0;
  v_detalle jsonb := '[]'::jsonb;
begin
  select decrypted_secret into v_url   from vault.decrypted_secrets where name = 'supabase_url';
  select decrypted_secret into v_clave from vault.decrypted_secrets where name = 'service_key';
  if v_url is null or v_clave is null then
    raise exception 'Faltan los secretos supabase_url/service_key en el Vault';
  end if;

  for v_fila in select * from planillas_a_purgar() loop
    v_cand := v_cand + 1;
    begin
      select * into v_resp from extensions.http((
        'DELETE',
        v_url || '/storage/v1/object/planillas-recepcion/' || v_fila.ruta,
        array[
          extensions.http_header('authorization','Bearer ' || v_clave),
          extensions.http_header('apikey', v_clave)
        ],
        null, null)::extensions.http_request);

      -- 200 = borrado. 404 = ya no estaba: el objetivo igual se cumplió.
      if v_resp.status in (200, 404) then
        perform marcar_planilla_purgada(v_fila.id);
        v_ok := v_ok + 1;
      else
        v_mal := v_mal + 1;
        v_detalle := v_detalle || jsonb_build_array(jsonb_build_object(
          'numero', v_fila.numero, 'status', v_resp.status));
      end if;
    exception when others then
      -- La fila queda para el próximo intento; nunca se marca a ciegas.
      v_mal := v_mal + 1;
      v_detalle := v_detalle || jsonb_build_array(jsonb_build_object(
        'numero', v_fila.numero, 'error', left(SQLERRM, 200)));
    end;
  end loop;

  insert into purga_ejecucion(candidatas, purgadas, fallidas, detalle)
  values (v_cand, v_ok, v_mal, v_detalle);

  return jsonb_build_object('candidatas', v_cand, 'purgadas', v_ok, 'fallidas', v_mal);
end; $$;

revoke execute on function purgar_planillas_recepcion() from public, anon, authenticated;

-- ---------- El job ----------
select cron.unschedule('purgar-planillas-recepcion')
 where exists (select 1 from cron.job where jobname = 'purgar-planillas-recepcion');

select cron.schedule(
  'purgar-planillas-recepcion',
  '15 4 * * *',                       -- 04:15 UTC = 01:15 en Salta
  $job$ select purgar_planillas_recepcion(); $job$
);
