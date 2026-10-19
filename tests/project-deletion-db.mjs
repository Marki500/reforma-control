// Optional integration check: PGLITE_MODULE must point to an installed PGlite module.
// Uses only an ephemeral in-memory database, never DATABASE_URL or Supabase.
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
const { PGlite } = await import(pathToFileURL(process.env.PGLITE_MODULE).href)
const db = new PGlite()
const owner = '11111111-1111-4111-8111-111111111111'
const outsider = '22222222-2222-4222-8222-222222222222'
const project = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const alternative = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
try {
  await db.exec(`
    CREATE ROLE authenticated;
    CREATE SCHEMA auth; CREATE SCHEMA storage;
    CREATE TABLE auth.users(id UUID PRIMARY KEY);
    INSERT INTO auth.users VALUES ('${owner}'), ('${outsider}');
    CREATE FUNCTION auth.uid() RETURNS UUID LANGUAGE sql STABLE AS $$SELECT nullif(current_setting('test.user', true), '')::UUID$$;
    CREATE TABLE public.projects(id UUID PRIMARY KEY, owner_id UUID);
    CREATE TABLE storage.objects(bucket_id TEXT, name TEXT, PRIMARY KEY(bucket_id,name));
    ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
    GRANT USAGE ON SCHEMA auth, storage TO authenticated;
    GRANT SELECT, DELETE ON storage.objects TO authenticated;
    CREATE FUNCTION public.is_project_member(p UUID, roles TEXT[]) RETURNS BOOLEAN LANGUAGE sql STABLE AS $$SELECT EXISTS(SELECT 1 FROM projects WHERE id=p AND owner_id=auth.uid())$$;
    CREATE FUNCTION public.delete_project(p_project_id UUID) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$BEGIN
      IF NOT public.is_project_member(p_project_id, ARRAY['owner']) THEN RAISE EXCEPTION 'not owner'; END IF;
      IF NOT EXISTS(SELECT 1 FROM projects WHERE id<>p_project_id AND owner_id=auth.uid()) THEN RAISE EXCEPTION 'last project'; END IF;
      DELETE FROM projects WHERE id=p_project_id;
    END$$;
    CREATE TABLE materials(project_id UUID REFERENCES projects ON DELETE CASCADE, main_image_url TEXT);
    CREATE TABLE inspirations(project_id UUID REFERENCES projects ON DELETE CASCADE, image_url TEXT);
    CREATE TABLE floor_plans(project_id UUID REFERENCES projects ON DELETE CASCADE, image_url TEXT);
    CREATE TABLE budget_pdfs(project_id UUID REFERENCES projects ON DELETE CASCADE, file_url TEXT);
    CREATE TABLE progress_photos(project_id UUID REFERENCES projects ON DELETE CASCADE, image_url TEXT);
    CREATE TABLE home_documents(project_id UUID REFERENCES projects ON DELETE CASCADE, file_url TEXT);
    SELECT set_config('test.user', '${owner}', false);
    INSERT INTO projects VALUES ('${project}', '${owner}');
    INSERT INTO storage.objects VALUES ('images','${project}/photo.png'), ('images','${project}/shared.png'), ('images','unrelated.png'), ('home-documents','${project}/private.pdf');
    INSERT INTO floor_plans VALUES ('${project}', 'https://legacy.example/storage/v1/object/public/images/${project}/photo.png?download=1');
    INSERT INTO home_documents VALUES ('${project}', '${project}/private.pdf');
  `)
  await db.exec(await readFile(new URL('../supabase/migrations/00029_safe_project_deletion.sql', import.meta.url), 'utf8'))
  // A failed database deletion must roll back the queue as well.
  await assert.rejects(db.query('SELECT delete_project_safely($1)', [project]), /last project/)
  assert.equal((await db.query('SELECT * FROM project_file_cleanup')).rows.length, 0)
  assert.equal((await db.query('SELECT * FROM projects')).rows.length, 1)
  assert.equal((await db.query('SELECT * FROM storage.objects')).rows.length, 4)

  await db.exec(`INSERT INTO projects VALUES ('${alternative}', '${owner}');
    INSERT INTO inspirations VALUES ('${project}', 'https://api.example/storage/v1/object/public/images/${project}/shared.png'),
    ('${alternative}', 'https://api.example/storage/v1/object/public/images/${project}/shared.png');`)
  await db.query("SELECT set_config('test.user', $1, false)", [outsider])
  await assert.rejects(db.query('SELECT delete_project_safely($1)', [project]), /propietario/)
  assert.equal((await db.query('SELECT * FROM project_file_cleanup')).rows.length, 0)
  await db.query("SELECT set_config('test.user', $1, false)", [owner])
  await db.query('SELECT delete_project_safely($1)', [project])
  const queue = (await db.query('SELECT bucket_id,object_name FROM project_file_cleanup ORDER BY bucket_id')).rows
  assert.deepEqual(queue, [
    { bucket_id: 'home-documents', object_name: `${project}/private.pdf` },
    { bucket_id: 'images', object_name: `${project}/photo.png` },
  ])
  assert.equal((await db.query('SELECT * FROM storage.objects')).rows.length, 4, 'DB transaction never deletes Storage objects')
  // Exercise the real RLS policies with a non-superuser role.
  await db.exec('SET ROLE authenticated')
  assert.equal((await db.query('SELECT * FROM storage.objects')).rows.length, 2)
  assert.equal((await db.query("DELETE FROM storage.objects WHERE name='unrelated.png' RETURNING *")).rows.length, 0)
  await db.query("SELECT set_config('test.user', $1, false)", [outsider])
  assert.equal((await db.query('SELECT * FROM project_file_cleanup')).rows.length, 0)
  assert.equal((await db.query('DELETE FROM storage.objects RETURNING *')).rows.length, 0)
  await db.query("SELECT set_config('test.user', $1, false)", [owner])
  assert.equal((await db.query('DELETE FROM storage.objects RETURNING *')).rows.length, 2)
  await db.query('DELETE FROM project_file_cleanup')
  assert.equal((await db.query('SELECT * FROM project_file_cleanup')).rows.length, 0)
  console.log('PASS: rollback, owner checks, exact manifest, shared references and Storage/queue RLS')
} finally { await db.close() }
