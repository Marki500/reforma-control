import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../services/supabaseClient'
import { formatCurrency } from '../utils/formatCurrency'
import { getCategoryBudgets, upsertCategoryBudget } from '../services/materialsService'
import {
  Package,
  Heart,
  CheckCircle,
  Clock,
  TrendingUp,
  AlertTriangle,
  ArrowRight,
  XCircle,
  Plus,
  ExternalLink,
  Pencil,
  StickyNote,
} from 'lucide-react'

export default function Dashboard() {
  const navigate = useNavigate()
  const [stats, setStats] = useState({
    total: 0,
    totalCost: 0,
    favorites: 0,
    purchased: 0,
    discarded: 0,
    pending: 0,
    highPriority: 0,
  })
  const [recentMaterials, setRecentMaterials] = useState([])
  const [categorySpending, setCategorySpending] = useState([])
  const [budgets, setBudgets] = useState({})
  const [editingBudget, setEditingBudget] = useState(null)
  const [budgetInput, setBudgetInput] = useState('')
  const [expandedCats, setExpandedCats] = useState({})
  const [resumenNotes, setResumenNotes] = useState([])
  const [loading, setLoading] = useState(true)

  const loadDashboard = async () => {
    try {
      const { data: userData } = await supabase.auth.getUser()
      if (!userData?.user) return

      const { data: materials, error } = await supabase
        .from('materials')
        .select('*, material_categories(name)')
        .order('created_at', { ascending: false })

      if (error) throw error

      const list = materials || []
      const counted = list.filter((m) => m.count_in_total !== false)
      setStats({
        total: list.length,
        totalCost: counted.reduce((sum, m) => sum + (m.price || 0) * (m.quantity || 1), 0),
        favorites: list.filter((m) => m.status === 'Favorito').length,
        purchased: list.filter((m) => ['Comprado', 'Recibido'].includes(m.status)).length,
        discarded: list.filter((m) => m.status === 'Descartado').length,
        pending: list.filter((m) => m.status === 'Pendiente de decidir').length,
        highPriority: list.filter((m) => ['Alta', 'Urgente'].includes(m.priority)).length,
      })

      setRecentMaterials(list.slice(0, 5))

      // Group spending by category (only counted materials)
      const byCategory = {}
      for (const m of list) {
        if (m.count_in_total === false) continue
        if (!m.category_id) continue
        const catName = m.material_categories?.name || 'Sin categoría'
        if (!byCategory[m.category_id]) {
          byCategory[m.category_id] = { id: m.category_id, name: catName, spent: 0, materials: [] }
        }
        byCategory[m.category_id].spent += (m.price || 0) * (m.quantity || 1)
        byCategory[m.category_id].materials.push({
          id: m.id,
          name: m.name,
          price: m.price,
          quantity: m.quantity,
        })
      }
      setCategorySpending(
        Object.values(byCategory).sort((a, b) => b.spent - a.spent)
      )

      // Load budgets
      const budgetList = await getCategoryBudgets()
      const budgetMap = {}
      for (const b of budgetList) {
        budgetMap[b.category_id] = b.budget_amount
      }
      setBudgets(budgetMap)

      // Load resumen notes
      const { data: notes } = await supabase
        .from('notes')
        .select('id, content, created_at')
        .eq('category', 'Resumen')
        .order('created_at', { ascending: false })
      setResumenNotes(notes || [])
    } catch (err) {
      console.error('Error loading dashboard:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadDashboard() }, [])

  async function handleSaveBudget(categoryId) {
    const amount = Number(budgetInput)
    if (isNaN(amount)) return
    try {
      await upsertCategoryBudget(categoryId, amount)
      setBudgets((prev) => ({ ...prev, [categoryId]: amount }))
      setEditingBudget(null)
    } catch (err) {
      console.error('Error saving budget:', err)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-stone-300 border-t-stone-600" />
      </div>
    )
  }

  const statCards = [
    { label: 'Materiales', value: stats.total, icon: Package, color: 'bg-olive-light text-olive' },
    { label: 'Favoritos', value: stats.favorites, icon: Heart, color: 'bg-gold-light text-gold' },
    { label: 'Comprados', value: stats.purchased, icon: CheckCircle, color: 'bg-green-100 text-green-700' },
    { label: 'Pendientes', value: stats.pending, icon: Clock, color: 'bg-amber-light text-amber' },
    { label: 'Prioridad alta', value: stats.highPriority, icon: AlertTriangle, color: 'bg-terracotta-light text-terracotta' },
    { label: 'Descartados', value: stats.discarded, icon: XCircle, color: 'bg-stone-200 text-stone-500' },
  ]

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-stone-800">Dashboard</h1>
          <p className="mt-1 text-sm text-stone-500">Control general de tu reforma</p>
        </div>
         <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={() => navigate('/materials?action=import')}
            className="inline-flex items-center gap-1.5 rounded-xl border border-stone-300 bg-white px-2.5 py-2 text-sm font-medium text-stone-700 transition-all hover:bg-stone-50 sm:gap-2 sm:px-4"
          >
            <ExternalLink size={16} />
            <span className="hidden sm:inline">Importar URL</span>
          </button>
          <button
            onClick={() => navigate('/materials?action=add')}
            className="inline-flex items-center gap-1.5 rounded-xl bg-stone-700 px-2.5 py-2 text-sm font-medium text-white transition-all hover:bg-stone-800 sm:gap-2 sm:px-4"
          >
            <Plus size={16} />
            <span className="hidden sm:inline">Añadir material</span>
          </button>
        </div>
      </div>

      {/* Coste total */}
      <div className="rounded-2xl bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-olive-light p-3">
            <TrendingUp size={24} className="text-olive" />
          </div>
          <div>
            <p className="text-sm text-stone-500">Coste total estimado</p>
            <p className="text-3xl font-bold text-stone-800">
              {formatCurrency(stats.totalCost)}
            </p>
          </div>
        </div>
      </div>

      {/* Resumen del proyecto */}
      {resumenNotes.length > 0 && (
        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-stone-800">
              <StickyNote size={18} className="text-olive" />
              Resumen del proyecto
            </h2>
            <button
              onClick={() => navigate('/notas')}
              className="inline-flex items-center gap-1 text-sm font-medium text-stone-600 hover:text-stone-800"
            >
              Ver notas <ArrowRight size={16} />
            </button>
          </div>
          <div className="space-y-3">
            {resumenNotes.map((note) => (
              <div key={note.id} className="rounded-xl border border-stone-100 bg-stone-50 p-4">
                <div className="prose prose-stone prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: note.content }} />
                <p className="mt-2 text-xs text-stone-400">
                  {new Date(note.created_at).toLocaleDateString('es-ES', {
                    day: 'numeric', month: 'short', year: 'numeric',
                  })}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
        {statCards.map((card) => {
          const Icon = card.icon
          return (
            <div
              key={card.label}
              className="rounded-2xl bg-white p-4 shadow-sm transition-all hover:shadow-md"
            >
              <div className={`mb-3 inline-flex rounded-xl p-2 ${card.color}`}>
                <Icon size={18} />
              </div>
              <p className="text-2xl font-bold text-stone-800">{card.value}</p>
              <p className="text-xs text-stone-500">{card.label}</p>
            </div>
          )
        })}
      </div>

      {/* Partidas por categoría */}
      {categorySpending.length > 0 && (
        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-stone-800">Partidas por categoría</h2>
            <span className="text-sm text-stone-500">
              {formatCurrency(categorySpending.reduce((s, c) => s + c.spent, 0))} gastado
            </span>
          </div>

          <div className="space-y-3">
            {categorySpending.map((cat) => {
              const budget = budgets[cat.id]
              const hasBudget = budget !== undefined && budget !== null
              const remaining = hasBudget ? budget - cat.spent : null
              const pct = hasBudget && budget > 0 ? Math.min((cat.spent / budget) * 100, 100) : 0

              return (
                <div key={cat.id} className="rounded-xl border border-stone-100 p-4">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-medium text-stone-700">{cat.name}</span>
                    <div className="flex items-center gap-2">
                      {editingBudget === cat.id ? (
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={budgetInput}
                            onChange={(e) => setBudgetInput(e.target.value)}
                            className="w-28 rounded-lg border border-stone-300 px-2 py-1 text-right text-sm"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveBudget(cat.id)
                              if (e.key === 'Escape') setEditingBudget(null)
                            }}
                          />
                          <button
                            onClick={() => handleSaveBudget(cat.id)}
                            className="rounded-lg bg-stone-700 px-2 py-1 text-xs text-white"
                          >
                            OK
                          </button>
                          <button
                            onClick={() => setEditingBudget(null)}
                            className="rounded-lg px-2 py-1 text-xs text-stone-500"
                          >
                            ✕
                          </button>
                        </div>
                      ) : (
                        <>
                          <span className="text-sm text-stone-500">
                            {formatCurrency(cat.spent)} gastado
                          </span>
                          {hasBudget && (
                            <span className={`text-sm font-medium ${
                              remaining < 0 ? 'text-red-500' : 'text-stone-600'
                            }`}>
                              · {formatCurrency(budget)} previsto
                            </span>
                          )}
                          <button
                            onClick={() => {
                              setEditingBudget(cat.id)
                              setBudgetInput(String(budget ?? ''))
                            }}
                            className="rounded-lg p-1.5 text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-600"
                          >
                            <Pencil size={14} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {hasBudget && (
                    <div className="h-2 w-full overflow-hidden rounded-full bg-stone-100">
                      <div
                        className={`h-full rounded-full transition-all ${
                          pct >= 100 ? 'bg-red-400' : pct >= 80 ? 'bg-gold' : 'bg-olive'
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  )}

                  <div className="mt-2 space-y-0.5">
                    {cat.materials.slice(0, expandedCats[cat.id] ? undefined : 5).map((m) => (
                      <div key={m.id} className="flex items-center justify-between text-xs text-stone-400">
                        <span className="truncate">{m.name}</span>
                        <span className="ml-2 flex-shrink-0">
                          {m.price ? `${formatCurrency(m.price)}${(m.quantity || 1) > 1 ? ` x${m.quantity}` : ''}` : '-'}
                        </span>
                      </div>
                    ))}
                    {cat.materials.length > 5 && (
                      <button
                        onClick={() =>
                          setExpandedCats((prev) => ({ ...prev, [cat.id]: !prev[cat.id] }))
                        }
                        className="mt-0.5 text-xs font-medium text-stone-500 hover:text-stone-700"
                      >
                        {expandedCats[cat.id]
                          ? 'Ver menos'
                          : `Ver más (${cat.materials.length - 5} restantes)`}
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Recent materials */}
      <div className="rounded-2xl bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-stone-800">Últimos materiales</h2>
          <button
            onClick={() => navigate('/materials')}
            className="inline-flex items-center gap-1 text-sm font-medium text-stone-600 hover:text-stone-800"
          >
            Ver todos <ArrowRight size={16} />
          </button>
        </div>

        {recentMaterials.length === 0 ? (
          <div className="rounded-xl bg-stone-50 px-6 py-12 text-center">
            <Package size={32} className="mx-auto mb-3 text-stone-300" />
            <p className="text-sm text-stone-500">Aún no has añadido materiales</p>
            <button
              onClick={() => navigate('/materials?action=add')}
              className="mt-3 text-sm font-medium text-stone-700 hover:underline"
            >
              Añadir tu primer material
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {recentMaterials.map((material) => (
              <div
                key={material.id}
                className="flex items-center gap-4 rounded-xl border border-stone-100 p-3 transition-colors hover:bg-stone-50"
              >
                <div className="h-12 w-12 flex-shrink-0 overflow-hidden rounded-lg bg-stone-100">
                  {material.main_image_url ? (
                    <img
                      src={material.main_image_url}
                      alt={material.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-stone-300">
                      <Package size={20} />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-stone-800">{material.name}</p>
                  <p className="text-xs text-stone-500">
                    {material.store_name && `${material.store_name} · `}
                    {material.price ? formatCurrency(material.price) : 'Sin precio'}
                    {(material.quantity || 1) > 1 && ` · x${material.quantity}`}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
