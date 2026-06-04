CREATE OR REPLACE FUNCTION public.get_signed_porter_occurrence(_hash text)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'id', po.id,
    'protocol', po.protocol,
    'title', po.title,
    'description', po.description,
    'category', po.category,
    'priority', po.priority,
    'status', po.status,
    'occurred_at', po.occurred_at,
    'created_at', po.created_at,
    'updated_at', po.updated_at,
    'resolution_notes', po.resolution_notes,
    'registered_by_name', p.full_name,
    'condominium', CASE WHEN c.id IS NULL THEN NULL ELSE jsonb_build_object(
      'name', c.name,
      'address', c.address,
      'city', c.city,
      'state', c.state
    ) END,
    'reporter_block', CASE WHEN rb.id IS NULL THEN NULL ELSE jsonb_build_object('name', rb.name) END,
    'reporter_apartment', CASE WHEN ra.id IS NULL THEN NULL ELSE jsonb_build_object('number', ra.number) END,
    'target_block', CASE WHEN tb.id IS NULL THEN NULL ELSE jsonb_build_object('name', tb.name) END,
    'target_apartment', CASE WHEN ta.id IS NULL THEN NULL ELSE jsonb_build_object('number', ta.number) END
  )
  FROM public.signed_documents sd
  JOIN public.porter_occurrences po
    ON po.signature_hash = sd.file_hash
    OR po.protocol = substring(sd.file_name from 'ocorrencia[_-]([^./]+)\.pdf')
  LEFT JOIN public.profiles p ON p.user_id = po.registered_by
  LEFT JOIN public.condominiums c ON c.id = po.condominium_id
  LEFT JOIN public.blocks rb ON rb.id = po.reporter_block_id
  LEFT JOIN public.apartments ra ON ra.id = po.reporter_apartment_id
  LEFT JOIN public.blocks tb ON tb.id = po.target_block_id
  LEFT JOIN public.apartments ta ON ta.id = po.target_apartment_id
  WHERE sd.file_hash = _hash
  ORDER BY po.created_at DESC
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_signed_porter_occurrence(text) TO anon, authenticated;
