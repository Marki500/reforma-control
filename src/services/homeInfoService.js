import { supabase } from './supabaseClient'

export async function getHomeInfo() {
  const { data, error } = await supabase.from('home_info').select('*').maybeSingle()
  if (error) throw error
  return data
}

export async function saveHomeInfo(form) {
  const { data: authData, error: authError } = await supabase.auth.getUser()
  if (authError) throw authError
  if (!authData.user) throw new Error('Inicia sesión de nuevo.')

  const optionalNumber = value => value === '' || value == null ? null : Number(value)
  const optionalDate = value => value || null
  const text = value => String(value || '').trim()
  const payload = {
    user_id: authData.user.id,
    address: text(form.address), postal_code: text(form.postal_code), city: text(form.city), province: text(form.province),
    property_type: text(form.property_type), cadastral_reference: text(form.cadastral_reference),
    construction_year: optionalNumber(form.construction_year), built_area: optionalNumber(form.built_area), usable_area: optionalNumber(form.usable_area),
    bedrooms: optionalNumber(form.bedrooms), bathrooms: optionalNumber(form.bathrooms),
    electricity_cups: text(form.electricity_cups), gas_cups: text(form.gas_cups), water_contract: text(form.water_contract),
    habitability_certificate_number: text(form.habitability_certificate_number), habitability_certificate_date: optionalDate(form.habitability_certificate_date), habitability_certificate_expiry: optionalDate(form.habitability_certificate_expiry),
    energy_certificate_number: text(form.energy_certificate_number), energy_rating: text(form.energy_rating), energy_certificate_expiry: optionalDate(form.energy_certificate_expiry),
    community_contact: text(form.community_contact), insurance_policy: text(form.insurance_policy), notes: text(form.notes),
    updated_at: new Date().toISOString(),
  }

  const { data, error } = await supabase.from('home_info').upsert(payload, { onConflict: 'user_id' }).select().single()
  if (error) throw error
  return data
}
