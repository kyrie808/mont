-- Stage 2b — Comprovante do repasse: bucket privado + RLS + RPC de leitura do entregador.
--
-- (1) Bucket PRIVADO `comprovantes` (arquivos em {entregador_id}/arquivo).
-- (2) RLS de storage: admin lê/escreve tudo; o entregador lê SÓ a própria pasta
--     (assim ele abre o próprio comprovante por signed URL, sem ver o dos outros).
-- (3) RPC entregador_meus_repasses(): os lançamentos de repasse dele (curados),
--     pra aba Ganhos do app mostrar "Repasses recebidos da Mont".
--
-- Backup: dump-{schema,data}-20260710 (stage2b).

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Bucket privado
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('comprovantes', 'comprovantes', false)
ON CONFLICT (id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. RLS de storage (scoped no bucket 'comprovantes' — não afeta 'products')
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "comprovantes admin all" ON storage.objects;
CREATE POLICY "comprovantes admin all" ON storage.objects
    FOR ALL TO authenticated
    USING (bucket_id = 'comprovantes' AND (SELECT public.is_admin()))
    WITH CHECK (bucket_id = 'comprovantes' AND (SELECT public.is_admin()));

DROP POLICY IF EXISTS "comprovantes entregador read own" ON storage.objects;
CREATE POLICY "comprovantes entregador read own" ON storage.objects
    FOR SELECT TO authenticated
    USING (
        bucket_id = 'comprovantes'
        AND (storage.foldername(name))[1] = (
            SELECT e.id::text FROM public.entregadores e WHERE e.user_id = (SELECT auth.uid())
        )
    );

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. entregador_meus_repasses() — os repasses que a Mont pagou a ELE (curado).
--    Só lançamentos com entregador_id = o dele (só os repasses setam entregador_id).
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.entregador_meus_repasses()
 RETURNS TABLE (
    lancamento_id   uuid,
    data            date,
    valor           numeric,
    categoria       text,
    comprovante_url text
 )
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_entregador_id uuid;
BEGIN
    IF NOT (SELECT public.is_entregador()) THEN
        RAISE EXCEPTION 'Acesso negado: apenas entregadores' USING ERRCODE = '42501';
    END IF;

    SELECT id INTO v_entregador_id
      FROM public.entregadores WHERE user_id = (SELECT auth.uid()) AND ativo = true;

    RETURN QUERY
    SELECT l.id, l.data, l.valor, pc.nome, l.comprovante_url
    FROM public.lancamentos l
    LEFT JOIN public.plano_de_contas pc ON pc.id = l.plano_conta_id
    WHERE l.entregador_id = v_entregador_id
    ORDER BY l.data DESC, l.criado_em DESC;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.entregador_meus_repasses() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.entregador_meus_repasses() TO authenticated;

NOTIFY pgrst, 'reload schema';
