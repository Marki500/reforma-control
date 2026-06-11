import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../services/supabaseClient'

export function useMaterials(filters = {}) {
  const [materials, setMaterials] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchMaterials = useCallback(async () => {
    try {
      setLoading(true)
      let query = supabase
        .from('materials')
        .select('*, rooms(name), material_categories(name)')
        .order('created_at', { ascending: false })

      if (filters.category_id) {
        query = query.eq('category_id', filters.category_id)
      }
      if (filters.room_id) {
        query = query.eq('room_id', filters.room_id)
      }
      if (filters.status) {
        query = query.eq('status', filters.status)
      }
      if (filters.priority) {
        query = query.eq('priority', filters.priority)
      }
      if (filters.search) {
        query = query.or(
          `name.ilike.%${filters.search}%,brand.ilike.%${filters.search}%,model.ilike.%${filters.search}%,store_name.ilike.%${filters.search}%`
        )
      }

      const { data, error } = await query

      if (error) throw error
      setMaterials(data || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [JSON.stringify(filters)])

  useEffect(() => {
    fetchMaterials()
  }, [fetchMaterials])

  return { materials, loading, error, refetch: fetchMaterials }
}
