
-- Profiles
CREATE TABLE public.profiles (
  id UUID NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  email TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, nome, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'nome', split_part(NEW.email, '@', 1)), NEW.email);
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Inventarios
CREATE TYPE public.inventario_status AS ENUM ('em_andamento','concluido');

CREATE TABLE public.inventarios (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  criador_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  senha_hash TEXT NOT NULL,
  status public.inventario_status NOT NULL DEFAULT 'em_andamento',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.inventarios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Criador vê seus inventários" ON public.inventarios FOR SELECT TO authenticated USING (auth.uid() = criador_id);
CREATE POLICY "Criador cria inventários" ON public.inventarios FOR INSERT TO authenticated WITH CHECK (auth.uid() = criador_id);
CREATE POLICY "Criador atualiza seus inventários" ON public.inventarios FOR UPDATE TO authenticated USING (auth.uid() = criador_id);
CREATE POLICY "Criador deleta seus inventários" ON public.inventarios FOR DELETE TO authenticated USING (auth.uid() = criador_id);

-- Itens (base SAP congelada)
CREATE TABLE public.itens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  inventario_id UUID NOT NULL REFERENCES public.inventarios(id) ON DELETE CASCADE,
  material TEXT NOT NULL,
  descricao TEXT,
  centro TEXT,
  deposito TEXT,
  em_qualidade NUMERIC NOT NULL DEFAULT 0,
  transito_te NUMERIC NOT NULL DEFAULT 0,
  bloqueado NUMERIC NOT NULL DEFAULT 0,
  utilizacao_livre NUMERIC NOT NULL DEFAULT 0,
  total_sap NUMERIC GENERATED ALWAYS AS (em_qualidade + transito_te + bloqueado + utilizacao_livre) STORED,
  unid_medida TEXT,
  lote TEXT,
  tipo_material TEXT,
  estoque_especial TEXT,
  num_estoque_especial TEXT,
  posicao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_itens_inventario ON public.itens(inventario_id);
CREATE INDEX idx_itens_material ON public.itens(inventario_id, material);
ALTER TABLE public.itens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Criador vê itens dos seus inventários" ON public.itens FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.inventarios i WHERE i.id = itens.inventario_id AND i.criador_id = auth.uid()));
CREATE POLICY "Criador insere itens nos seus inventários" ON public.itens FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.inventarios i WHERE i.id = itens.inventario_id AND i.criador_id = auth.uid()));
CREATE POLICY "Criador deleta itens dos seus inventários" ON public.itens FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.inventarios i WHERE i.id = itens.inventario_id AND i.criador_id = auth.uid()));

-- Contagens
CREATE TABLE public.contagens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  inventario_id UUID NOT NULL REFERENCES public.inventarios(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES public.itens(id) ON DELETE CASCADE,
  nome_contador TEXT NOT NULL,
  quantidade NUMERIC NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(item_id, nome_contador)
);
CREATE INDEX idx_contagens_inventario ON public.contagens(inventario_id);
CREATE INDEX idx_contagens_item ON public.contagens(item_id);
ALTER TABLE public.contagens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Criador vê contagens dos seus inventários" ON public.contagens FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.inventarios i WHERE i.id = contagens.inventario_id AND i.criador_id = auth.uid()));
-- Inserts de contagens são feitos apenas via Edge Function (service role) com validação de senha

-- Trigger updated_at
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
CREATE TRIGGER touch_inventarios BEFORE UPDATE ON public.inventarios FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER touch_contagens BEFORE UPDATE ON public.contagens FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
