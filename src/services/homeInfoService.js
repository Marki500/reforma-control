import { supabase } from './supabaseClient'
export async function getHomeInfo() {
  const { data, error } = await supabase.rpc('get_home_info')
  if (error) throw error
  return Array.isArray(data) ? data[0] || null : data
}

export async function saveHomeInfo(form) {
  const text = value => String(value || '').trim()
  const payload = {
    address: text(form.address), postal_code: text(form.postal_code), city: text(form.city), province: text(form.province),
    property_type: text(form.property_type), cadastral_reference: text(form.cadastral_reference),
    construction_year: form.construction_year ?? '', built_area: form.built_area ?? '', usable_area: form.usable_area ?? '',
    bedrooms: form.bedrooms ?? '', bathrooms: form.bathrooms ?? '',
    electricity_cups: text(form.electricity_cups), gas_cups: text(form.gas_cups), water_contract: text(form.water_contract),
    habitability_certificate_number: text(form.habitability_certificate_number), habitability_certificate_date: form.habitability_certificate_date || '', habitability_certificate_expiry: form.habitability_certificate_expiry || '',
    energy_certificate_number: text(form.energy_certificate_number), energy_rating: text(form.energy_rating), energy_certificate_expiry: form.energy_certificate_expiry || '',
    community_contact: text(form.community_contact), insurance_policy: text(form.insurance_policy), notes: text(form.notes),
  }

  const { data, error } = await supabase.rpc('save_home_info', { p_data: payload })
  if (error) throw error
  return Array.isArray(data) ? data[0] : data
}
