const STORAGE_KEY = 'space-station-html-v1'
const PERSON = { A: '阿杨', B: '阿冯' }
const WEEKDAY = ['日', '一', '二', '三', '四', '五', '六']
const DEFAULT_KINDS = [
  { id: 'play', label: '出去玩', builtin: true },
  { id: 'gym', label: '健身', builtin: true },
  { id: 'other', label: '游泳', builtin: true },
]

const defaultState = {
  events: [],
  kinds: structuredClone(DEFAULT_KINDS),
  savings: {
    goal: 5000,
    goalLabel: '一起去看海',
    entries: [],
  },
}

const config = window.SPACE_CONFIG || {}
let roomRef = null
let applyingRemote = false
let syncMode = 'local' // local | cloud | error

function normalizeKinds(input) {
  const list = Array.isArray(input) ? input : []
  const cleaned = list
    .map((item) => {
      if (!item || typeof item !== 'object') return null
      const id = String(item.id || '').trim()
      const label = String(item.label || '').trim()
      if (!id || !label) return null
      return {
        id,
        label: label.slice(0, 12),
        builtin: Boolean(item.builtin),
      }
    })
    .filter(Boolean)

  if (cleaned.length === 0) return structuredClone(DEFAULT_KINDS)

  const seen = new Set()
  const unique = cleaned.filter((kind) => {
    if (seen.has(kind.id)) return false
    seen.add(kind.id)
    return true
  })

  // 内置类型文案以代码为准（例如「其他」→「游泳」）
  return unique.map((kind) => {
    const builtin = DEFAULT_KINDS.find((d) => d.id === kind.id)
    if (!builtin) return kind
    return { ...kind, label: builtin.label, builtin: true }
  })
}

function loadLocalState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return structuredClone(defaultState)
    const parsed = JSON.parse(raw)
    return {
      events: parsed.events || [],
      kinds: normalizeKinds(parsed.kinds),
      savings: {
        ...defaultState.savings,
        ...(parsed.savings || {}),
        entries: (parsed.savings && parsed.savings.entries) || [],
      },
    }
  } catch {
    return structuredClone(defaultState)
  }
}

function normalizeState(input) {
  const raw = input || {}
  return {
    events: Array.isArray(raw.events) ? raw.events : [],
    kinds: normalizeKinds(raw.kinds),
    savings: {
      goal: Number(raw.savings && raw.savings.goal) || defaultState.savings.goal,
      goalLabel:
        (raw.savings && raw.savings.goalLabel) || defaultState.savings.goalLabel,
      entries: Array.isArray(raw.savings && raw.savings.entries)
        ? raw.savings.entries
        : [],
    },
  }
}

let state = loadLocalState()
let viewMonth = startOfMonth(new Date())
let selectedDate = new Date()

function setSyncStatus(mode, text) {
  syncMode = mode
  const el = document.getElementById('sync-status')
  if (!el) return
  el.textContent = text
  el.dataset.mode = mode
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  if (applyingRemote || !roomRef) return
  roomRef
    .set(state)
    .then(() => setSyncStatus('cloud', '云端已同步 · 两人共用'))
    .catch(() => setSyncStatus('error', '同步失败，请检查 Firebase 配置'))
}

function applyState(next, fromRemote) {
  state = normalizeState(next)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  if (fromRemote) {
    applyingRemote = true
    renderAll()
    applyingRemote = false
  } else {
    renderAll()
  }
}

function renderAll() {
  renderTogether()
  renderKindChips()
  renderCalendar()
  renderSavings()
}

function firebaseReady() {
  const fb = config.firebase || {}
  return Boolean(fb.apiKey && fb.databaseURL && fb.projectId && config.roomId)
}

function initCloud() {
  if (!firebaseReady()) {
    setSyncStatus('local', '仅本机存储 · 按 README 配置后可双人同步')
    return
  }

  try {
    firebase.initializeApp(config.firebase)
    roomRef = firebase.database().ref(`rooms/${config.roomId}`)
    setSyncStatus('cloud', '正在连接云端…')

    roomRef.on(
      'value',
      (snap) => {
        const remote = snap.val()
        if (!remote) {
          // 云端还是空的：把本机数据上传上去
          roomRef.set(state)
          setSyncStatus('cloud', '云端已同步 · 两人共用')
          return
        }
        applyState(remote, true)
        setSyncStatus('cloud', '云端已同步 · 两人共用')
      },
      () => {
        setSyncStatus('error', '连接失败，请检查 Realtime Database 是否已创建')
      },
    )
  } catch (err) {
    console.error(err)
    setSyncStatus('error', 'Firebase 初始化失败，请检查 config.js')
  }
}

function pad(n) {
  return String(n).padStart(2, '0')
}

function toKey(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function addMonths(date, n) {
  return new Date(date.getFullYear(), date.getMonth() + n, 1)
}

function isSameDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

function diffYMD(from, to) {
  const start = new Date(from.getFullYear(), from.getMonth(), from.getDate())
  const end = new Date(to.getFullYear(), to.getMonth(), to.getDate())

  let years = end.getFullYear() - start.getFullYear()
  let months = end.getMonth() - start.getMonth()
  let days = end.getDate() - start.getDate()

  if (days < 0) {
    months -= 1
    const prev = new Date(end.getFullYear(), end.getMonth(), 0)
    days += prev.getDate()
  }
  if (months < 0) {
    years -= 1
    months += 12
  }

  const totalDays = Math.max(0, Math.round((end - start) / 86400000))
  return { years, months, days, totalDays }
}

function whoLabel(who) {
  if (who === 'A') return PERSON.A
  if (who === 'B') return PERSON.B
  return '一起'
}

function kindLabel(kindId) {
  const found = state.kinds.find((k) => k.id === kindId)
  if (found) return found.label
  const legacy = { play: '出去玩', gym: '健身', other: '游泳' }
  return legacy[kindId] || kindId || '游泳'
}

function ensureSelectedKind() {
  const input = document.getElementById('event-kind')
  if (!input) return
  if (!state.kinds.some((k) => k.id === input.value)) {
    input.value = state.kinds[0] ? state.kinds[0].id : 'other'
  }
}

function renderKindChips() {
  const row = document.getElementById('kind-chips')
  const kindInput = document.getElementById('event-kind')
  if (!row || !kindInput) return

  ensureSelectedKind()
  const selected = kindInput.value

  row.innerHTML = state.kinds
    .map((kind) => {
      const active = kind.id === selected ? ' is-active' : ''
      const remove = kind.builtin
        ? ''
        : `<button type="button" class="chip-remove" data-remove-kind="${kind.id}" aria-label="删除 ${kind.label}">×</button>`
      return `<div class="chip-wrap">
        <button type="button" class="chip${active}" data-kind="${kind.id}">${kind.label}</button>
        ${remove}
      </div>`
    })
    .join('')

  row.querySelectorAll('[data-kind]').forEach((btn) => {
    btn.addEventListener('click', () => {
      kindInput.value = btn.getAttribute('data-kind')
      renderKindChips()
    })
  })

  row.querySelectorAll('[data-remove-kind]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation()
      const id = btn.getAttribute('data-remove-kind')
      state.kinds = state.kinds.filter((k) => k.id !== id)
      if (kindInput.value === id) {
        kindInput.value = state.kinds[0] ? state.kinds[0].id : 'other'
      }
      saveState()
      renderKindChips()
    })
  })
}

function renderTogether() {
  const start = new Date(2023, 5, 24)
  const now = new Date()
  const d = diffYMD(new Date(start), new Date(now))
  document.getElementById('together-clock').innerHTML = [
    ['年', d.years],
    ['月', d.months],
    ['天', d.days],
  ]
    .map(
      ([label, value]) =>
        `<div class="time-unit"><span class="time-value">${value}</span><span class="time-label">${label}</span></div>`,
    )
    .join('')
  document.getElementById('together-total').textContent =
    `已经一起走过 ${d.totalDays} 天`
}

function renderCalendar() {
  const label = document.getElementById('month-label')
  label.textContent = `${viewMonth.getFullYear()}年 ${viewMonth.getMonth() + 1}月`

  const first = startOfMonth(viewMonth)
  const startOffset = (first.getDay() + 6) % 7
  const gridStart = new Date(first)
  gridStart.setDate(first.getDate() - startOffset)

  const grid = document.getElementById('calendar-grid')
  grid.innerHTML = ''

  for (let i = 0; i < 42; i += 1) {
    const day = new Date(gridStart)
    day.setDate(gridStart.getDate() + i)
    const key = toKey(day)
    const dayEvents = state.events.filter((e) => e.date === key)
    const hasA = dayEvents.some((e) => e.who === 'A' || e.who === 'both')
    const hasB = dayEvents.some((e) => e.who === 'B' || e.who === 'both')
    const inMonth = day.getMonth() === viewMonth.getMonth()
    const selected = isSameDay(day, selectedDate)
    const today = isSameDay(day, new Date())

    const btn = document.createElement('button')
    btn.type = 'button'
    btn.className = [
      'calendar-day',
      inMonth ? '' : 'is-muted',
      selected ? 'is-selected' : '',
      today ? 'is-today' : '',
    ]
      .filter(Boolean)
      .join(' ')
    btn.innerHTML = `
      <span class="calendar-day-num">${day.getDate()}</span>
      <span class="calendar-dots">
        ${hasA ? '<i class="dot a"></i>' : ''}
        ${hasB ? '<i class="dot b"></i>' : ''}
      </span>
    `
    btn.addEventListener('click', () => {
      selectedDate = day
      renderCalendar()
      renderSelectedDay()
    })
    grid.appendChild(btn)
  }

  renderSelectedDay()
}

function renderSelectedDay() {
  const key = toKey(selectedDate)
  const weekday = WEEKDAY[selectedDate.getDay()]
  document.getElementById('selected-label').textContent =
    `${selectedDate.getMonth() + 1}月${selectedDate.getDate()}日 星期${weekday}`

  const list = document.getElementById('event-list')
  const dayEvents = state.events.filter((e) => e.date === key)

  if (dayEvents.length === 0) {
    list.innerHTML = '<p class="muted">还没有标记。</p>'
    return
  }

  list.innerHTML = `<ul class="event-list">${dayEvents
    .map((event) => {
      const label = kindLabel(event.kind)
      const note =
        event.note && event.note !== label ? ` · ${event.note}` : ''
      return `
      <li>
        <div>
          <strong class="who-${event.who}">${whoLabel(event.who)}</strong>
          <span class="event-kind-tag">${label}</span>${note ? `<span>${note}</span>` : ''}
        </div>
        <button type="button" class="linkish" data-remove="${event.id}">删除</button>
      </li>`
    })
    .join('')}</ul>`

  list.querySelectorAll('[data-remove]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.events = state.events.filter((e) => e.id !== btn.getAttribute('data-remove'))
      saveState()
      renderCalendar()
    })
  })
}

function savingsTotal() {
  return state.savings.entries.reduce((sum, e) => sum + e.amount, 0)
}

function renderSavings() {
  const saved = savingsTotal()
  const { goal, goalLabel, entries } = state.savings
  const progress = Math.min(100, Math.round((saved / Math.max(1, goal)) * 100))

  document.getElementById('savings-peek').textContent =
    `${goalLabel} · 已攒 ¥${saved} / ¥${goal}（${progress}%）`
  document.getElementById('goal-label-view').textContent = goalLabel
  document.getElementById('savings-amount-view').innerHTML =
    `<span>¥${saved.toLocaleString()}</span><span class="savings-goal"> / ¥${goal.toLocaleString()}</span>`
  document.getElementById('savings-bar').style.width = `${progress}%`
  document.getElementById('savings-progress-text').textContent = `已完成 ${progress}%`
  document.getElementById('goal-label-input').value = goalLabel
  document.getElementById('goal-amount-input').value = String(goal)

  const list = document.getElementById('savings-list')
  if (entries.length === 0) {
    list.innerHTML = '<p class="muted">还没有记录，先从一笔小钱开始吧。</p>'
    return
  }

  list.innerHTML = `<ul class="savings-list">${entries
    .map(
      (entry) => `
      <li>
        <div>
          <strong>+¥${entry.amount}</strong>
          <span>${entry.note}</span>
        </div>
        <div class="savings-meta">
          <span>${whoLabel(entry.by)}</span>
          <button type="button" class="linkish" data-remove-saving="${entry.id}">删除</button>
        </div>
      </li>`,
    )
    .join('')}</ul>`

  list.querySelectorAll('[data-remove-saving]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.savings.entries = state.savings.entries.filter(
        (e) => e.id !== btn.getAttribute('data-remove-saving'),
      )
      saveState()
      renderSavings()
    })
  })
}

function showPage(page) {
  document.getElementById('page-home').hidden = page !== 'home'
  document.getElementById('page-savings').hidden = page !== 'savings'
  document.querySelectorAll('.sidebar-link').forEach((link) => {
    link.classList.toggle('is-active', link.getAttribute('data-page') === page)
  })
}

function uid() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function slugifyKind(label) {
  const base = label
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\w\u4e00-\u9fff-]/g, '')
  return `custom-${base || 'kind'}-${Math.random().toString(16).slice(2, 6)}`
}

document.querySelectorAll('.sidebar-link').forEach((link) => {
  link.addEventListener('click', () => showPage(link.getAttribute('data-page')))
})

document.getElementById('go-savings').addEventListener('click', (e) => {
  e.preventDefault()
  showPage('savings')
})

document.getElementById('prev-month').addEventListener('click', () => {
  viewMonth = addMonths(viewMonth, -1)
  renderCalendar()
})

document.getElementById('next-month').addEventListener('click', () => {
  viewMonth = addMonths(viewMonth, 1)
  renderCalendar()
})

document.getElementById('who-chips').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-who]')
  if (!btn) return
  document.getElementById('event-who').value = btn.getAttribute('data-who')
  document.querySelectorAll('#who-chips .chip').forEach((chip) => {
    chip.classList.toggle('is-active', chip === btn)
  })
})

document.getElementById('toggle-kind-form').addEventListener('click', () => {
  const panel = document.getElementById('kind-create')
  const open = panel.hidden
  panel.hidden = !open
  if (open) {
    document.getElementById('new-kind-label').focus()
  }
})

document.getElementById('add-kind-btn').addEventListener('click', () => {
  const input = document.getElementById('new-kind-label')
  const label = input.value.trim().slice(0, 12)
  if (!label) return
  if (state.kinds.some((k) => k.label === label)) {
    input.value = ''
    return
  }
  const kind = { id: slugifyKind(label), label, builtin: false }
  state.kinds.push(kind)
  document.getElementById('event-kind').value = kind.id
  input.value = ''
  document.getElementById('kind-create').hidden = true
  saveState()
  renderKindChips()
})

document.getElementById('new-kind-label').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault()
    document.getElementById('add-kind-btn').click()
  }
})

document.getElementById('event-form').addEventListener('submit', (e) => {
  e.preventDefault()
  const who = document.getElementById('event-who').value
  const kind = document.getElementById('event-kind').value
  const note = document.getElementById('event-note').value.trim()
  const label = kindLabel(kind)
  state.events.unshift({
    id: uid(),
    date: toKey(selectedDate),
    who,
    kind,
    note: note || label,
  })
  document.getElementById('event-note').value = ''
  saveState()
  renderCalendar()
})

document.getElementById('add-savings-form').addEventListener('submit', (e) => {
  e.preventDefault()
  const data = new FormData(e.currentTarget)
  const amount = Number(data.get('amount'))
  if (!amount || amount <= 0) return
  state.savings.entries.unshift({
    id: uid(),
    amount,
    note: String(data.get('note') || '').trim() || '一笔小积蓄',
    by: data.get('by'),
  })
  e.currentTarget.reset()
  saveState()
  renderSavings()
})

document.getElementById('goal-form').addEventListener('submit', (e) => {
  e.preventDefault()
  const data = new FormData(e.currentTarget)
  const goal = Number(data.get('goal'))
  const goalLabel = String(data.get('goalLabel') || '').trim() || '共同小目标'
  if (!goal || goal <= 0) return
  state.savings.goal = goal
  state.savings.goalLabel = goalLabel
  saveState()
  renderSavings()
})

renderAll()
showPage('home')
initCloud()
