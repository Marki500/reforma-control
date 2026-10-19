// Optional PostgreSQL integration test; uses an ephemeral PGlite DB only.
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
const { PGlite } = await import(pathToFileURL(process.env.PGLITE_MODULE).href)
const db = new PGlite()
const owner = '11111111-1111-4111-8111-111111111111', viewer = '22222222-2222-4222-8222-222222222222'
const project = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', other = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const draft = n => ({ id: id(n), name: 'Factura ventanas', supplier_name: 'Carpintería Sur', supplier_tax_id: 'B12345678', invoice_number: `F-${n}`, issued_date: '2026-10-19', currency: 'EUR', category: 'Material', subtotal: '100', tax_amount: '21', tax_rate: '21', total_amount: '121', paid_amount: '0', file_path: `${project}/${id(n)}.pdf`, file_type: 'application/pdf', file_size: 20 })
const count = async table => Number((await db.query(`SELECT count(*) AS total FROM ${table}`)).rows[0].total)
const register = async (data, expense = null) => (await db.query('SELECT register_invoice($1::jsonb,$2::uuid) AS expense', [JSON.stringify(data), expense])).rows[0].expense
const store = async data => db.query("INSERT INTO storage.objects(bucket_id,name,owner) VALUES('invoices',$1,$2) ON CONFLICT DO NOTHING", [data.file_path, owner])
try {
  await db.exec(`
    CREATE ROLE authenticated; CREATE SCHEMA auth; CREATE SCHEMA storage;
    CREATE TABLE auth.users(id UUID PRIMARY KEY); INSERT INTO auth.users VALUES('${owner}'),('${viewer}');
    CREATE FUNCTION auth.uid() RETURNS UUID LANGUAGE sql STABLE AS $$SELECT current_setting('test.user')::UUID$$;
    CREATE FUNCTION public.current_project_id() RETURNS UUID LANGUAGE sql STABLE AS $$SELECT current_setting('test.project')::UUID$$;
    CREATE TABLE projects(id UUID PRIMARY KEY); INSERT INTO projects VALUES('${project}'),('${other}');
    CREATE TABLE members(project_id UUID,user_id UUID,role TEXT); INSERT INTO members VALUES('${project}','${owner}','owner'),('${project}','${viewer}','viewer');
    CREATE FUNCTION public.is_project_member(p UUID,roles TEXT[] DEFAULT NULL) RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER AS $$SELECT EXISTS(SELECT 1 FROM members WHERE project_id=p AND user_id=auth.uid() AND (roles IS NULL OR role=ANY(roles)))$$;
    CREATE TABLE storage.buckets(id TEXT PRIMARY KEY,name TEXT,public BOOLEAN,file_size_limit BIGINT,allowed_mime_types TEXT[]);
    CREATE TABLE storage.objects(bucket_id TEXT,name TEXT,owner UUID,PRIMARY KEY(bucket_id,name)); ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
    CREATE FUNCTION storage.foldername(name TEXT) RETURNS TEXT[] LANGUAGE sql AS $$SELECT string_to_array(name,'/')$$;
    CREATE TABLE rooms(id UUID PRIMARY KEY,user_id UUID,project_id UUID);
    CREATE TABLE project_file_cleanup(id UUID DEFAULT gen_random_uuid(),requested_by UUID,bucket_id TEXT,object_name TEXT,UNIQUE(requested_by,bucket_id,object_name));
    CREATE FUNCTION public.log_project_row_change() RETURNS TRIGGER LANGUAGE plpgsql AS $$BEGIN IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW; END$$;
    GRANT USAGE ON SCHEMA public,auth,storage TO authenticated;
    GRANT SELECT,INSERT,DELETE ON storage.objects TO authenticated;
    SELECT set_config('test.user','${owner}',false), set_config('test.project','${project}',false);
  `)
  await db.exec(await readFile(new URL('../supabase/migrations/00014_expenses.sql', import.meta.url), 'utf8'))
  await db.exec(await readFile(new URL('../supabase/migrations/00015_suppliers.sql', import.meta.url), 'utf8'))
  await db.exec('ALTER TABLE expenses ADD COLUMN project_id UUID REFERENCES projects ON DELETE CASCADE; ALTER TABLE suppliers ADD COLUMN project_id UUID REFERENCES projects ON DELETE CASCADE;')
  await db.exec(await readFile(new URL('../supabase/migrations/00030_invoices.sql', import.meta.url), 'utf8'))
  const first = draft(1); await store(first)
  const expense = await register(first)
  assert.equal(await count('invoices'), 1); assert.equal(await count('expenses'), 1)
  assert.equal((await db.query('SELECT paid_amount FROM expenses WHERE id=$1', [expense])).rows[0].paid_amount, '0.00')
  assert.equal(await register(first), expense, 'retries reuse the first committed expense')
  assert.equal(await count('expenses'), 1)

  const duplicate = { ...draft(2), invoice_number: 'f1', supplier_name: 'CARPINTERIA SUR' }; await store(duplicate)
  await assert.rejects(register(duplicate), /duplicate key/)
  assert.equal(await count('expenses'), 1, 'duplicate cannot leave an orphan expense')
  const target = (await db.query("INSERT INTO expenses(user_id,project_id,title,amount,paid_amount,budgeted_amount) VALUES($1,$2,'Presupuesto aceptado',200,40,200) RETURNING id", [owner, project])).rows[0].id
  await assert.rejects(register({ ...duplicate, supplier_name: 'Nombre diferente', expected_paid_amount: '40' }, target), /duplicate key/)
  assert.equal((await db.query('SELECT amount FROM expenses WHERE id=$1', [target])).rows[0].amount, '200.00', 'duplicate rolls back updates to an existing expense')

  const linked = { ...draft(3), paid_amount: '40', expected_paid_amount: '40' }; await store(linked)
  await assert.rejects(register({ ...linked, expected_paid_amount: '20' }, target), /pagos de ese gasto han cambiado/)
  assert.equal(await register(linked, target), target)
  assert.equal(await count('expenses'), 2)
  const linkedCost = (await db.query('SELECT amount,paid_amount,budgeted_amount FROM expenses WHERE id=$1', [target])).rows[0]
  assert.deepEqual(linkedCost, { amount: '121.00', paid_amount: '40.00', budgeted_amount: '200.00' })
  await assert.rejects(db.query('UPDATE expenses SET amount=999 WHERE id=$1', [target]), /vinculado a una factura/)
  await db.query('UPDATE expenses SET paid_amount=121 WHERE id=$1', [target])
  await assert.rejects(db.query('DELETE FROM expenses WHERE id=$1', [target]), /foreign key/)
  await assert.rejects(register({ ...draft(4), total_amount: '999', paid_amount: '1000' }), /cantidad pagada/)
  await assert.rejects(register({ ...draft(4), currency: 'USD' }), /EUR/)
  const wrongProjectExpense = (await db.query("INSERT INTO expenses(user_id,project_id,title) VALUES($1,$2,'Otra reforma') RETURNING id", [owner, other])).rows[0].id
  const fourth = draft(4); await store(fourth)
  await assert.rejects(register(fourth, wrongProjectExpense), /no pertenece/)

  await db.exec('SET ROLE authenticated')
  assert.equal((await db.query('SELECT * FROM invoices')).rows.length, 2)
  assert.equal((await db.query('SELECT * FROM storage.objects')).rows.length, 4)
  await assert.rejects(db.query('DELETE FROM invoices'), /permission denied/)
  await db.query("SELECT set_config('test.user',$1,false)", [viewer])
  assert.equal((await db.query('SELECT * FROM invoices')).rows.length, 2)
  await assert.rejects(register(fourth), /permiso/)
  await assert.rejects(db.query('SELECT delete_invoice($1)', [first.id]), /permiso/)
  await assert.rejects(db.query("INSERT INTO storage.objects(bucket_id,name,owner) VALUES('invoices',$1,$2)", [`${project}/viewer.pdf`, viewer]), /row-level security/)
  await db.query("SELECT set_config('test.project',$1,false)", [other])
  assert.equal((await db.query('SELECT * FROM invoices')).rows.length, 0)
  assert.equal((await db.query('SELECT * FROM storage.objects')).rows.length, 0)
  await db.exec('RESET ROLE')
  assert.equal((await db.query("SELECT public FROM storage.buckets WHERE id='invoices'")).rows[0].public, false)
  await db.query("SELECT set_config('test.project',$1,false),set_config('test.user',$2,false)", [project, owner])

  await db.query('SELECT discard_invoice_upload($1,$2)', [first.id, first.file_path])
  assert.equal(await count('project_file_cleanup'), 0, 'a lost registration response must not delete the committed attachment')
  await db.query('SELECT discard_invoice_upload($1,$2)', [fourth.id, fourth.file_path])
  await assert.rejects(register(fourth), /descartado/)
  await db.query('SELECT delete_invoice($1)', [first.id])
  assert.equal(await count('expenses'), 3, 'removing a document preserves its expense and payments')
  assert.equal(await count('invoices'), 1)
  await db.query('DELETE FROM projects WHERE id=$1', [project])
  assert.equal(await count('invoices'), 0, 'project deletion cascades safely through invoice and expense')
  assert.ok((await db.query('SELECT * FROM project_file_cleanup WHERE object_name=$1', [linked.file_path])).rows.length)
  console.log('PASS: invoice registration, idempotency, duplicates, rollback, existing expenses, payments, RLS, private files and project deletion')
} catch (error) { console.error('FAIL:', error.message, error.detail || '', error.where || '', 'at', error.position, error.internalPosition, String(error.query || '').slice(Math.max(Number(error.position || 1) - 140, 0), Number(error.position || 1) + 180)); process.exitCode = 1 } finally { await db.close() }
