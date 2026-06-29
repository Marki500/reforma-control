import { useState, useEffect } from 'react'
import { Modal } from '../ui/Modal'
import { getCategories } from '../../services/materialsService'

export default function BudgetGridConfig({
  open,
  onClose,
  columns,
  rows,
  cells,
  onSave,
}) {
  const [numCols, setNumCols] = useState(columns)
  const [numRows, setNumRows] = useState(rows)
  const [gridCells, setGridCells] = useState(cells)
  const [categories, setCategories] = useState([])

  function buildCells(numCols, numRows, existing) {
    const result = []
    for (let r = 0; r < numRows; r++) {
      for (let c = 0; c < numCols; c++) {
        const found = existing.find(
          (cell) => cell.row_index === r && cell.col_index === c
        )
        result.push(
          found || {
            row_index: r,
            col_index: c,
            category_id: '',
            budget_amount: 0,
          }
        )
      }
    }
    return result
  }

  useEffect(() => {
    if (open) {
      setNumCols(columns)
      setNumRows(rows)
      setGridCells(buildCells(columns, rows, cells))
      getCategories()
        .then((cats) => setCategories(cats))
        .catch(() => {})
    }
  }, [open, columns, rows, cells])

  function handleResize(newCols, newRows) {
    const clampedCols = Math.min(Math.max(newCols, 1), 4)
    const clampedRows = Math.min(Math.max(newRows, 1), 6)
    setNumCols(clampedCols)
    setNumRows(clampedRows)

    setGridCells((prev) => buildCells(clampedCols, clampedRows, prev))
  }

  function updateCell(row, col, key, value) {
    setGridCells((prev) => {
      const exists = prev.some(
        (cell) => cell.row_index === row && cell.col_index === col
      )
      if (exists) {
        return prev.map((cell) =>
          cell.row_index === row && cell.col_index === col
            ? { ...cell, [key]: value }
            : cell
        )
      }
      return [
        ...prev,
        { row_index: row, col_index: col, [key]: value, budget_amount: 0 },
      ]
    })
  }

  function handleSave() {
    const cleaned = gridCells.map((cell) => ({
      row_index: cell.row_index,
      col_index: cell.col_index,
      category_id: cell.category_id || null,
      budget_amount: Number(cell.budget_amount) || 0,
    }))
    onSave({ numColumns: numCols, numRows: numRows, cells: cleaned })
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title="Configurar grid de presupuesto">
      <div className="space-y-5">
        <div className="flex gap-4">
          <div className="flex-1">
            <label className="mb-1 block text-sm font-medium text-stone-700">
              Columnas
            </label>
            <input
              type="number"
              min={1}
              max={4}
              value={numCols}
              onChange={(e) =>
                handleResize(Number(e.target.value), numRows)
              }
              className="w-full rounded-xl border border-stone-300 px-4 py-3 text-stone-800"
            />
          </div>
          <div className="flex-1">
            <label className="mb-1 block text-sm font-medium text-stone-700">
              Filas
            </label>
            <input
              type="number"
              min={1}
              max={6}
              value={numRows}
              onChange={(e) =>
                handleResize(numCols, Number(e.target.value))
              }
              className="w-full rounded-xl border border-stone-300 px-4 py-3 text-stone-800"
            />
          </div>
        </div>

        <div
          className="grid gap-3"
          style={{ gridTemplateColumns: `repeat(${numCols}, 1fr)` }}
        >
          {Array.from({ length: numRows }).map((_, r) =>
            Array.from({ length: numCols }).map((_, c) => {
              const cell = gridCells.find(
                (cell) => cell.row_index === r && cell.col_index === c
              ) || { row_index: r, col_index: c, category_id: '', budget_amount: 0 }
              return (
                <div
                  key={`${r}-${c}`}
                  className="rounded-xl border border-stone-200 bg-stone-50 p-3"
                >
                  <p className="mb-2 text-xs font-medium text-stone-500">
                    {r + 1}.{c + 1}
                  </p>
                  <select
                    value={cell.category_id || ''}
                    onChange={(e) =>
                      updateCell(r, c, 'category_id', e.target.value)
                    }
                    className="mb-2 w-full rounded-lg border border-stone-300 px-2 py-2 text-sm"
                  >
                    <option value="">-- Seleccionar --</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="Presupuesto €"
                    value={cell.budget_amount || ''}
                    onChange={(e) =>
                      updateCell(r, c, 'budget_amount', e.target.value)
                    }
                    className="w-full rounded-lg border border-stone-300 px-2 py-2 text-sm"
                  />
                </div>
              )
            })
          )}
        </div>

        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="rounded-xl border border-stone-300 px-4 py-2.5 text-sm font-medium text-stone-700"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            className="rounded-xl bg-stone-700 px-4 py-2.5 text-sm font-medium text-white"
          >
            Guardar
          </button>
        </div>
      </div>
    </Modal>
  )
}
