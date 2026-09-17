import { useEffect, useMemo, useState } from 'react'
import type { DragEvent } from 'react'
import type { EarnedGraduationStage, GraduationStage, MarketItem, MarketStatus } from './types'

const STORAGE_KEY = 'wow-market-dashboard-v1'

const demoItems: MarketItem[] = [
  {
    id: crypto.randomUUID(),
    name: 'Meaty Bat Wing',
    marginPct: 100,
    latestTurnoverPct: 50,
    previousTurnoverPct: 0,
    successfulCycles: 0,
    lowTurnoverCycles: 0,
    targetReductionCount: 0,
    everGraduated: false,
    earnedGraduationStage: 'testing',
    reviewStage: null,
    acquisitionPerDay: 40,
    stock: 80,
    targetStock: 100,
    lastChecked: new Date().toISOString().slice(0, 10),
    status: 'focus',
    notes: 'Test market — replace with real launch data.',
  },
  {
    id: crypto.randomUUID(),
    name: 'Obscure Leather',
    marginPct: 240,
    latestTurnoverPct: 30,
    previousTurnoverPct: 0,
    successfulCycles: 0,
    lowTurnoverCycles: 0,
    targetReductionCount: 0,
    everGraduated: false,
    earnedGraduationStage: 'testing',
    reviewStage: null,
    acquisitionPerDay: 20,
    stock: 35,
    targetStock: 60,
    lastChecked: new Date().toISOString().slice(0, 10),
    status: 'focus',
    notes: '',
  },
  {
    id: crypto.randomUUID(),
    name: 'Rare Fish',
    marginPct: 500,
    latestTurnoverPct: 5,
    previousTurnoverPct: 0,
    successfulCycles: 0,
    lowTurnoverCycles: 0,
    targetReductionCount: 0,
    everGraduated: false,
    earnedGraduationStage: 'testing',
    reviewStage: null,
    acquisitionPerDay: 10,
    stock: 40,
    targetStock: 50,
    lastChecked: new Date().toISOString().slice(0, 10),
    status: 'watch',
    notes: 'Potential appreciation candidate.',
  },
]

function loadItems(): MarketItem[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      return (JSON.parse(saved) as Array<MarketItem & { turnoverPct?: number }>).map(item => ({
        ...item,
        latestTurnoverPct: item.latestTurnoverPct ?? item.turnoverPct ?? 0,
        previousTurnoverPct: item.previousTurnoverPct ?? 0,
        successfulCycles: item.successfulCycles ?? 0,
        lowTurnoverCycles: item.lowTurnoverCycles ?? 0,
        targetReductionCount: item.targetReductionCount ?? 0,
        everGraduated: item.everGraduated ?? false,
        earnedGraduationStage: item.earnedGraduationStage
          ?? (item.everGraduated ? 'graduated' : item.successfulCycles >= 4 ? 'proven' : 'testing'),
        reviewStage: item.reviewStage ?? null,
      }))
    }
  } catch {
    // Fall back to demo data.
  }
  return demoItems
}

const statusLabels: Record<MarketStatus, string> = {
  focus: '🔥 Focus',
  maintain: '🟢 Maintain',
  watch: '🟡 Watch',
  speculate: '🔵 Speculate',
  review: '🔴 Review',
  drop: '⚫ Drop',
}

function suggestedScore(item: MarketItem) {
  const margin = Math.max(0, item.marginPct)
  const turnover = Math.max(0, item.latestTurnoverPct)
  const supplyPressure = item.acquisitionPerDay > 0
    ? Math.min(2, Math.max(0.25, item.latestTurnoverPct / 100 * 20 / item.acquisitionPerDay))
    : 2
  const bufferNeed = item.targetStock > 0
    ? Math.max(0, (item.targetStock - item.stock) / item.targetStock)
    : 0
  return Math.round((margin * turnover / 100) * (1 + supplyPressure) * (1 + bufferNeed))
}

function turnoverTrend(item: MarketItem) {
  const change = item.latestTurnoverPct - item.previousTurnoverPct
  if (change === 0) return { symbol: '—', label: 'No change', className: 'flat' }
  if (item.previousTurnoverPct === 0) {
    return change > 0
      ? { symbol: '↑↑', label: 'Much higher', className: 'up-strong' }
      : { symbol: '↓↓', label: 'Much lower', className: 'down-strong' }
  }

  const changePct = change / Math.abs(item.previousTurnoverPct)
  if (changePct >= 0.25) return { symbol: '↑↑', label: 'Much higher', className: 'up-strong' }
  if (changePct > 0) return { symbol: '↑', label: 'Slightly higher', className: 'up' }
  if (changePct <= -0.25) return { symbol: '↓↓', label: 'Much lower', className: 'down-strong' }
  return { symbol: '↓', label: 'Slightly lower', className: 'down' }
}

function graduationScore(item: MarketItem) {
  return Math.min(100, suggestedScore(item))
}

function graduationEligible(item: MarketItem) {
  return graduationScore(item) >= 70
    && item.latestTurnoverPct >= 60
    && item.previousTurnoverPct >= 50
    && item.successfulCycles >= 4
    && item.lowTurnoverCycles === 0
    && item.targetReductionCount === 0
}

function graduationStage(item: MarketItem): GraduationStage {
  if (item.reviewStage) return 'review'
  if (item.earnedGraduationStage !== 'testing') return item.earnedGraduationStage
  return graduationEligible(item) ? 'proven' : 'testing'
}

function reserveMultiplier(item: MarketItem, stage: GraduationStage) {
  const reserveStage = stage === 'review' ? item.reviewStage : stage
  if (reserveStage === 'graduated') return 1
  if (reserveStage === 'proven') return 0.5
  return 0
}

function desiredStock(item: MarketItem) {
  const stage = graduationStage(item)
  return item.targetStock + Math.round(item.targetStock * reserveMultiplier(item, stage))
}

function App() {
  const [items, setItems] = useState<MarketItem[]>(loadItems)
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [turnoverAtFocus, setTurnoverAtFocus] = useState<Record<string, number>>({})
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('wow-market-dashboard-theme') === 'dark')
  const [showForm, setShowForm] = useState(false)

  useEffect(() => {
    document.documentElement.dataset.theme = darkMode ? 'dark' : 'light'
    localStorage.setItem('wow-market-dashboard-theme', darkMode ? 'dark' : 'light')
  }, [darkMode])

  const persist = (next: MarketItem[]) => {
    setItems(next)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  }

  const sortedScore = useMemo(
    () => [...items].sort((a, b) => suggestedScore(b) - suggestedScore(a)),
    [items],
  )

  function updateItem(id: string, patch: Partial<MarketItem>) {
    persist(items.map(item => {
      if (item.id !== id) return item
      const targetWasReduced = patch.targetStock !== undefined
        && item.targetStock > 0
        && patch.targetStock < item.targetStock * 0.75
      return {
        ...item,
        ...patch,
        targetReductionCount: item.targetReductionCount + (targetWasReduced ? 1 : 0),
      }
    }))
  }

  function recordCycle(id: string, successful: boolean) {
    persist(items.map(item => {
      if (item.id !== id) return item
      const currentStage = graduationStage(item)
      const exitingReview = !successful && currentStage === 'review'
      const enteringReview = !successful && (currentStage === 'graduated' || currentStage === 'proven')
      const nextSuccessfulCycles = successful
        ? Math.min(6, item.successfulCycles + 1)
        : enteringReview
          ? item.successfulCycles
          : 0
      const nextLowTurnoverCycles = successful ? 0 : item.lowTurnoverCycles + 1
      const qualifiesAsProven = graduationScore(item) >= 70
        && item.latestTurnoverPct >= 60
        && item.previousTurnoverPct >= 50
        && nextSuccessfulCycles >= 4
        && item.targetReductionCount === 0
      const qualifiesAsGraduated = nextSuccessfulCycles >= 6
        && item.latestTurnoverPct >= 60
        && item.previousTurnoverPct >= 60
        && nextLowTurnoverCycles === 0
      const nextReviewStage = successful
        ? null
        : enteringReview
          ? currentStage
          : item.reviewStage
      return {
        ...item,
        successfulCycles: nextSuccessfulCycles,
        lowTurnoverCycles: nextLowTurnoverCycles,
        everGraduated: item.everGraduated || qualifiesAsGraduated,
        earnedGraduationStage: exitingReview
          ? 'testing'
          : successful
          ? item.reviewStage
            ?? (qualifiesAsGraduated ? 'graduated' : qualifiesAsProven ? 'proven' : item.earnedGraduationStage)
          : item.earnedGraduationStage,
        reviewStage: exitingReview ? null : nextReviewStage,
      }
    }))
  }

  function commitLatestTurnover(id: string) {
    const previousValue = turnoverAtFocus[id]
    if (previousValue === undefined) return

    const item = items.find(candidate => candidate.id === id)
    if (item && item.latestTurnoverPct !== previousValue) {
      persist(items.map(candidate => candidate.id === id
        ? { ...candidate, previousTurnoverPct: previousValue }
        : candidate))
    }
    setTurnoverAtFocus(current => {
      const next = { ...current }
      delete next[id]
      return next
    })
  }

  function removeItem(id: string) {
    persist(items.filter(item => item.id !== id))
  }

  function addItem() {
    const item: MarketItem = {
      id: crypto.randomUUID(),
      name: 'New Market',
      marginPct: 0,
      latestTurnoverPct: 0,
      previousTurnoverPct: 0,
      successfulCycles: 0,
      lowTurnoverCycles: 0,
      targetReductionCount: 0,
      everGraduated: false,
      earnedGraduationStage: 'testing',
      reviewStage: null,
      acquisitionPerDay: 0,
      stock: 0,
      targetStock: 0,
      lastChecked: new Date().toISOString().slice(0, 10),
      status: 'watch',
      notes: '',
    }
    persist([...items, item])
  }

  function moveItem(sourceId: string, targetId: string) {
    if (sourceId === targetId) return
    const sourceIndex = items.findIndex(x => x.id === sourceId)
    const targetIndex = items.findIndex(x => x.id === targetId)
    if (sourceIndex < 0 || targetIndex < 0) return

    const next = [...items]
    const [moved] = next.splice(sourceIndex, 1)
    next.splice(targetIndex, 0, moved)
    persist(next)
  }

  function onDrop(e: DragEvent<HTMLTableRowElement>, targetId: string) {
    e.preventDefault()
    if (draggedId) moveItem(draggedId, targetId)
    setDraggedId(null)
  }

  function resetDemo() {
    persist(demoItems.map(item => ({ ...item, id: crypto.randomUUID() })))
  }

  return (
    <main className="app">
      <header className="header">
        <div>
          <p className="eyebrow">WoW Forever · Personal Economy</p>
          <h1>Market Dashboard</h1>
          <p className="subtitle">
            Keep a small portfolio of markets, watch sell-through, maintain buffers,
            and move your attention toward whatever currently deserves it.
          </p>
        </div>
        <div className="header-actions">
          <button onClick={() => setDarkMode(current => !current)}>
            {darkMode ? '☀ Light mode' : '☾ Dark mode'}
          </button>
          <button className="primary" onClick={() => { addItem(); setShowForm(true) }}>+ Add market</button>
          <button onClick={resetDemo}>Reset demo</button>
        </div>
      </header>

      <section className="summary">
        <div className="metric">
          <span>Markets</span>
          <strong>{items.length}</strong>
        </div>
        <div className="metric">
          <span>Focus</span>
          <strong>{items.filter(x => x.status === 'focus').length}</strong>
        </div>
        <div className="metric">
          <span>Needs review</span>
          <strong>{items.filter(x => x.status === 'review').length}</strong>
        </div>
        <div className="metric">
          <span>Buffer gaps</span>
          <strong>{items.filter(item => item.stock < desiredStock(item)).length}</strong>
        </div>
      </section>

      <section className="info">
        <div>
          <strong>Workflow:</strong> take inventory → update sales → adjust priorities →
          acquire the highest-priority items → refill your buffers.
        </div>
        <div>
          <strong>Graduation:</strong> record successful cycles deliberately. Four qualifying cycles can earn a half-target reserve;
          six can earn a full target reserve. A poor cycle puts graduated markets under review.
        </div>
      </section>

      <section className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Market</th>
              <th>Margin</th>
              <th>Latest Turnover</th>
              <th>Previous Turnover</th>
              <th>Trend</th>
              <th>Lifecycle</th>
              <th>Cycles</th>
              <th>Acquire/day</th>
              <th>Stock / Target</th>
              <th>Stock / Desired</th>
              <th>Status</th>
              <th>Checked</th>
              <th>Score</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, index) => {
              const stage = graduationStage(item)
              const reserve = Math.round(item.targetStock * reserveMultiplier(item, stage))
              const cycleReady = graduationScore(item) >= 70 && item.latestTurnoverPct >= 60
              const bufferPct = item.targetStock > 0
                ? Math.min(100, Math.round(item.stock / item.targetStock * 100))
                : 100
              return (
                <tr
                  key={item.id}
                  onDragOver={e => e.preventDefault()}
                  onDrop={e => onDrop(e, item.id)}
                  className={draggedId === item.id ? 'dragging' : ''}
                >
                  <td className="rank">{index + 1}</td>
                  <td className="name-cell">
                    <span
                      className="drag-handle"
                      draggable
                      onDragStart={() => setDraggedId(item.id)}
                      onDragEnd={() => setDraggedId(null)}
                    >⋮⋮</span>
                    <input
                      value={item.name}
                      onChange={e => updateItem(item.id, { name: e.target.value })}
                    />
                    <textarea
                      value={item.notes}
                      placeholder="Notes..."
                      onChange={e => updateItem(item.id, { notes: e.target.value })}
                    />
                  </td>
                  <td><input type="number" value={item.marginPct} onChange={e => updateItem(item.id, { marginPct: Number(e.target.value) })} />%</td>
                  <td><input
                    type="number"
                    value={item.latestTurnoverPct}
                    onFocus={() => setTurnoverAtFocus(current => ({ ...current, [item.id]: item.latestTurnoverPct }))}
                    onChange={e => updateItem(item.id, { latestTurnoverPct: Number(e.target.value) })}
                    onBlur={() => commitLatestTurnover(item.id)}
                  />%</td>
                  <td><input className="turnover-previous" type="number" value={item.previousTurnoverPct} readOnly />%</td>
                  <td>
                    {(() => {
                      const trend = turnoverTrend(item)
                      return <span className={`turnover-trend ${trend.className}`} title={trend.label}>{trend.symbol}</span>
                    })()}
                  </td>
                  <td><span className={`lifecycle-badge ${stage}`}>{stage}</span></td>
                  <td>
                    <div className="cycle-count">{item.successfulCycles}/6</div>
                    <div className="cycle-actions">
                      <button
                        className="cycle-button success"
                        title={cycleReady ? 'Record successful cycle' : 'Score must be at least 70 and latest turnover at least 60%'}
                        disabled={!cycleReady}
                        onClick={() => recordCycle(item.id, true)}
                      >✓</button>
                      <button
                        className="cycle-button failure"
                        title="Record failed cycle"
                        onClick={() => recordCycle(item.id, false)}
                      >×</button>
                    </div>
                  </td>
                  <td><input type="number" value={item.acquisitionPerDay} onChange={e => updateItem(item.id, { acquisitionPerDay: Number(e.target.value) })} /></td>
                  <td className="stock-cell">
                    <div className="stock-inputs">
                      <input type="number" value={item.stock} onChange={e => updateItem(item.id, { stock: Number(e.target.value) })} />
                      <span>/</span>
                      <input type="number" value={item.targetStock} onChange={e => updateItem(item.id, { targetStock: Number(e.target.value) })} />
                    </div>
                    <div className="bar"><span style={{ width: `${bufferPct}%` }} /></div>
                  </td>
                  <td className="reserve-cell">
                    <strong>{item.stock}</strong> / {desiredStock(item)}
                    <span>{reserveMultiplier(item, stage)}× target reserve</span>
                  </td>
                  <td>
                    <select value={item.status} onChange={e => updateItem(item.id, { status: e.target.value as MarketStatus })}>
                      {Object.entries(statusLabels).map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                  </td>
                  <td><input type="date" value={item.lastChecked} onChange={e => updateItem(item.id, { lastChecked: e.target.value })} /></td>
                  <td className="score">{suggestedScore(item)}</td>
                  <td><button className="delete" onClick={() => removeItem(item.id)}>×</button></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </section>

      <section className="bottom-grid">
        <div className="panel">
          <h2>Suggested attention</h2>
          <p className="muted">This is guidance only; your manual priority order is what matters.</p>
          <ol>
            {sortedScore.slice(0, 5).map(item => (
              <li key={item.id}>
                <strong>{item.name}</strong>
                <span>score {suggestedScore(item)} · {item.stock}/{item.targetStock} stock</span>
              </li>
            ))}
          </ol>
        </div>
        <div className="panel">
          <h2>Decision rules</h2>
          <ul>
            <li><strong>High latest turnover + good margin:</strong> keep stocked.</li>
            <li><strong>Sales exceed acquisition:</strong> prioritize acquisition.</li>
            <li><strong>Buffer full:</strong> rotate to another market.</li>
            <li><strong>Three failed AH cycles:</strong> investigate instead of blindly reposting.</li>
            <li><strong>Strong future thesis + constrained supply:</strong> mark as Speculate.</li>
          </ul>
        </div>
      </section>
    </main>
  )
}

export default App