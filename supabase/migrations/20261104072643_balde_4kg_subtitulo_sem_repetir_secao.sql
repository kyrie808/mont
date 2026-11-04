-- Balde 4 kg: o subtítulo não repete a frase da seção Resfriados ("Queijo Canastra de verdade...").
-- Backup antes: supabase/backups/dumps/dump-*-20261104-042331.sql
UPDATE public.produtos
   SET subtitulo = 'Rende pra família toda.'
 WHERE codigo = 'balde_pao_queijo_4kg'
   AND subtitulo = 'Queijo Canastra de verdade. Rende pra família toda.';
