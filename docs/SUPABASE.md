# Activer la synchronisation Supabase

Par défaut, Vinyl Vault stocke tout sur l'appareil. Pour synchroniser plusieurs appareils :

1. Créer un projet sur https://supabase.com (offre gratuite suffisante).
2. Dans **SQL Editor**, exécuter :

```sql
create table public.vaults (
  user_id uuid primary key references auth.users (id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.vaults enable row level security;

create policy "lecture de son coffre" on public.vaults
  for select using (auth.uid() = user_id);
create policy "création de son coffre" on public.vaults
  for insert with check (auth.uid() = user_id);
create policy "mise à jour de son coffre" on public.vaults
  for update using (auth.uid() = user_id);
```

3. **Authentication › URL Configuration** : ajouter l'URL GitHub Pages (`https://<utilisateur>.github.io/vinyl-vault/`) aux *Redirect URLs*.
4. Dans le dépôt GitHub : **Settings › Secrets and variables › Actions › Variables**, créer
   - `VITE_SUPABASE_URL` = URL du projet
   - `VITE_SUPABASE_ANON_KEY` = clé *anon* (publique par conception, protégée par les règles RLS ci-dessus)
5. Relancer le workflow de déploiement.

Ne jamais utiliser la clé `service_role` côté application.

Limites actuelles : la synchronisation est manuelle (envoyer / récupérer) et les photos prises avec l'app restent sur l'appareil. Les notifications push en arrière-plan nécessiteront une fonction serveur (Edge Function + clés VAPID) qui pourra s'appuyer sur cette même table.
