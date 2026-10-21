// Optional PostgreSQL integration; uses an ephemeral DB, never Supabase.
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
const { PGlite } = await import(pathToFileURL(process.env.PGLITE_MODULE).href)
const db = new PGlite()
const project = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', other = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', owner = '11111111-1111-4111-8111-111111111111'
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const budget = n => ({ id: id(n), name: 'Presupuesto ejemplo', file_url: `https://files.example/${n}.pdf`, file_size: 100, total_amount: 121, subtotal: 100, tax_amount: 21, status: 'Recibido', line_items: [] })
const supplier = { name: 'Fontanería Sur S.L.', tax_id: 'B12345678', email: 'sur@example.com', phone: '933123123', address: 'Calle ejemplo 1' }
const save = async (data, vendor = supplier, p = project) => (await db.query('SELECT create_budget_with_supplier($1::jsonb,$2::jsonb,$3::uuid) AS result', [JSON.stringify(data), JSON.stringify(vendor), p])).rows[0].result
const count = async table => Number((await db.query(`SELECT count(*) AS n FROM ${table}`)).rows[0].n)
try {
  await db.exec(`CREATE ROLE authenticated; CREATE SCHEMA auth; CREATE TABLE projects(id UUID PRIMARY KEY); INSERT INTO projects VALUES('${project}'),('${other}');
    CREATE FUNCTION auth.uid() RETURNS UUID LANGUAGE sql STABLE AS $$SELECT '${owner}'::UUID$$;
    CREATE FUNCTION current_project_id() RETURNS UUID LANGUAGE sql STABLE AS $$SELECT '${project}'::UUID$$;
    CREATE FUNCTION is_project_member(p UUID,roles TEXT[] DEFAULT NULL) RETURNS BOOLEAN LANGUAGE sql STABLE AS $$SELECT p=current_project_id() AND (roles IS NULL OR current_setting('test.role')=ANY(roles))$$;
    CREATE TABLE material_categories(id UUID PRIMARY KEY,project_id UUID);
    CREATE TABLE suppliers(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),user_id UUID,project_id UUID,name TEXT NOT NULL,trade TEXT,phone TEXT,email TEXT,address TEXT,status TEXT,contacted BOOLEAN);
    CREATE TABLE budget_pdfs(id UUID PRIMARY KEY,user_id UUID,project_id UUID,supplier_id UUID REFERENCES suppliers(id),category_id UUID,name TEXT NOT NULL,file_url TEXT NOT NULL,file_size BIGINT,notes TEXT,total_amount NUMERIC CHECK(total_amount>=0),issued_date DATE,valid_until DATE,status TEXT,payment_terms TEXT,warranty TEXT,quote_number TEXT,subtotal NUMERIC,tax_rate NUMERIC,tax_amount NUMERIC,line_items JSONB,ai_extracted BOOLEAN,ai_model TEXT);
    ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY; ALTER TABLE budget_pdfs ENABLE ROW LEVEL SECURITY;
    CREATE POLICY s_read ON suppliers FOR SELECT USING(project_id=current_project_id());
    CREATE POLICY s_write ON suppliers FOR INSERT WITH CHECK(project_id=current_project_id() AND is_project_member(project_id,ARRAY['owner','editor']));
    CREATE POLICY b_read ON budget_pdfs FOR SELECT USING(project_id=current_project_id());
    CREATE POLICY b_write ON budget_pdfs FOR INSERT WITH CHECK(project_id=current_project_id() AND is_project_member(project_id,ARRAY['owner','editor']));
    GRANT USAGE ON SCHEMA auth TO authenticated; GRANT SELECT,INSERT ON suppliers,budget_pdfs TO authenticated; GRANT SELECT ON material_categories TO authenticated;
    SELECT set_config('test.role','owner',false);`)
  await db.exec(await readFile(new URL('../supabase/migrations/00031_budget_supplier_creation.sql', import.meta.url), 'utf8'))
  await db.exec('SET ROLE authenticated')
  await db.query('SELECT resolve_budget_supplier_upload($1,$2)', [id(9), project])
  await assert.rejects(save(budget(9)), /descartado/)
  const first = await save(budget(1))
  assert.equal((await db.query('SELECT resolve_budget_supplier_upload($1,$2) AS result', [id(1), project])).rows[0].result.saved, true)
  assert.equal(first.supplier_created, true)
  const vendor = (await db.query('SELECT status,contacted FROM suppliers')).rows[0]
  assert.equal(vendor.status, 'Candidato'); assert.equal(vendor.contacted, false)
  const retry = await save(budget(1)); assert.equal(retry.supplier_id, first.supplier_id)
  assert.equal(await count('suppliers'), 1); assert.equal(await count('budget_pdfs'), 1)
  const second = await save(budget(2), { ...supplier, name: 'Nombre alternativo', email: 'no-cambiar@example.com' })
  assert.equal(second.supplier_id, first.supplier_id)
  assert.equal((await db.query('SELECT email FROM suppliers')).rows[0].email, supplier.email)
  const byName = await save(budget(3), { name: 'FONTÀNERIA SUR, SL' })
  assert.equal(byName.supplier_id, first.supplier_id)
  await assert.rejects(save({ ...budget(4), file_url: null }, { name: 'No debe crearse' }), /null value/)
  assert.equal(await count('suppliers'), 1)
  await assert.rejects(save(budget(5), supplier, other), /permiso/)
  await db.exec("SELECT set_config('test.role','viewer',false)")
  await assert.rejects(save(budget(6)), /permiso/)
  await db.exec("SELECT set_config('test.role','editor',false)")
  await db.query("INSERT INTO suppliers(project_id,name,status) VALUES($1,'Duplicado','Archivado'),($1,'DUPLICADO','Candidato')", [project])
  await assert.rejects(save(budget(7), { name: 'duplicado' }), /varios proveedores/)
  await db.exec('RESET ROLE')
  await db.query('INSERT INTO suppliers(project_id,name,tax_id) VALUES($1,$2,$3)', [other, 'Otro proyecto', supplier.tax_id])
  await db.exec('SET ROLE authenticated')
  assert.equal((await save(budget(8))).supplier_id, first.supplier_id)
  await assert.rejects(db.query('INSERT INTO suppliers(project_id,name,tax_id) VALUES($1,$2,$3)', [project, 'Nuevo', 'B-12345678']), /unique/)
  console.log('PASS: creación atómica, reintentos, NIF/nombre, ambigüedad, rollback y permisos/proyectos.')
} finally { await db.close() }
