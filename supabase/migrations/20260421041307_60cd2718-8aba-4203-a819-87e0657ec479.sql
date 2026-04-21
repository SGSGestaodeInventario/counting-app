-- Permitir ao criador inserir/editar/excluir contagens dos seus inventários
CREATE POLICY "Criador insere contagens dos seus inventários"
ON public.contagens
FOR INSERT
TO authenticated
WITH CHECK (EXISTS (
  SELECT 1 FROM public.inventarios i
  WHERE i.id = contagens.inventario_id AND i.criador_id = auth.uid()
));

CREATE POLICY "Criador atualiza contagens dos seus inventários"
ON public.contagens
FOR UPDATE
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.inventarios i
  WHERE i.id = contagens.inventario_id AND i.criador_id = auth.uid()
));

CREATE POLICY "Criador deleta contagens dos seus inventários"
ON public.contagens
FOR DELETE
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.inventarios i
  WHERE i.id = contagens.inventario_id AND i.criador_id = auth.uid()
));

-- Função para purgar inventários expirados (>7 dias)
CREATE OR REPLACE FUNCTION public.purgar_inventarios_expirados()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE qtd integer;
BEGIN
  WITH del AS (
    DELETE FROM public.inventarios
    WHERE created_at < (now() - interval '7 days')
    RETURNING 1
  )
  SELECT count(*) INTO qtd FROM del;
  RETURN qtd;
END;
$$;

GRANT EXECUTE ON FUNCTION public.purgar_inventarios_expirados() TO anon, authenticated;