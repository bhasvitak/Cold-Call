import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'

export const STAGES = [
  {
    number: 1,
    name: 'Opening',
    purpose: 'Reach the right person and say who you are. The prospect decides in the first ten seconds whether this call is worth a minute.',
    maySay: [
      '“Haanji, boliye. Who is speaking and what is this regarding?”',
      '“He is on the plant floor / in a meeting right now, call after 3 PM.”',
      '“You have reached reception; the person you asked for left the company.”',
    ],
    events: [
      { id: 'reached_person', label: 'Reached right person' },
      { id: 'gatekeeper', label: 'Reception / Assistant' },
      { id: 'busy_meeting', label: 'Busy / In a meeting' },
      { id: 'wrong_contact', label: 'Wrong number / Left company' },
    ],
    defaultOutcome: 'wrong_person',
  },
  {
    number: 2,
    name: 'Purpose',
    purpose: 'Say why you called in one or two sentences the prospect can repeat to a colleague.',
    maySay: [
      '“Meridian Growth Partners? What does your company actually do?”',
      '“Where did you get my direct personal mobile number?”',
      '“Is this a sales call? We get ten of these calls every day.”',
    ],
    events: [
      { id: 'asked_what_we_do', label: 'Asked what company does' },
      { id: 'asked_source', label: 'Asked where number came from' },
      { id: 'guessed_sales_call', label: 'Guessed it is a sales call' },
      { id: 'let_caller_proceed', label: 'Allowed caller to continue' },
    ],
    defaultOutcome: 'call_again',
  },
  {
    number: 3,
    name: 'Permission',
    purpose: 'Find out whether they are willing to talk now. A clear yes, a clear no, or a time to call back are all good outcomes.',
    maySay: [
      '“Haan boliye, I have two minutes, tell me quickly.”',
      '“I am driving / with a client right now, call me tomorrow afternoon.”',
      '“Send your one-pager on WhatsApp first, then we can talk.”',
    ],
    events: [
      { id: 'talk_now', label: 'Agreed to talk now' },
      { id: 'callback_requested', label: 'Requested callback time' },
      { id: 'whatsapp_first', label: 'Asked for WhatsApp first' },
      { id: 'declined', label: 'Declined to continue' },
    ],
    defaultOutcome: 'call_again',
  },
  {
    number: 4,
    name: 'Their business',
    purpose: 'Ask about their company and their work before saying anything about yours. People talk about what they do.',
    maySay: [
      '“We are an auto-component manufacturer with two plants in Pune.”',
      '“We don’t manufacture that line anymore, we only do trading.”',
      '“Why don’t you first explain what Meridian can do for someone like us?”',
    ],
    events: [
      { id: 'shared_operations', label: 'Shared operations & capacity' },
      { id: 'corrected_scope', label: 'Corrected company scope' },
      { id: 'asked_for_pitch', label: 'Asked caller to pitch first' },
      { id: 'refused_details', label: 'Guarded / Refused details' },
    ],
    defaultOutcome: 'follow_up',
  },
  {
    number: 5,
    name: 'Their need, in their words',
    purpose: 'Hear what they are trying to do or struggling with, in their own words. The caller writes down exactly what was said.',
    maySay: [
      '“Our plant capacity is running at 60%, we need new OEM export buyers.”',
      '“Domestic market margins are tight, we want to expand into tier-2 cities.”',
      '“Everything is running smoothly, we have no requirements right now.”',
    ],
    events: [
      { id: 'growth_goal', label: 'Stated growth / revenue goal' },
      { id: 'capacity_bottleneck', label: 'Stated capacity / margin bottleneck' },
      { id: 'no_need', label: 'Said everything is fine / no need' },
      { id: 'exploring', label: 'Uncertain / Exploring options' },
    ],
    defaultOutcome: 'interested',
  },
  {
    number: 6,
    name: 'Objection',
    purpose: 'Hear the reason for a no and understand it. A reason you understand can be answered on this call or the next.',
    maySay: [
      '“We already have an in-house agency / consultant handling growth.”',
      '“I am not the right person, you need to speak with our Managing Director.”',
      '“Send something in writing on WhatsApp or email, we will see.”',
    ],
    events: [
      { id: 'already_has_agency', label: 'Already has agency / consultant' },
      { id: 'wrong_contact', label: 'Referred to MD / other person' },
      { id: 'send_written_info', label: 'Requested written info first' },
      { id: 'not_interested', label: 'Flat refusal / Not interested' },
    ],
    defaultOutcome: 'not_interested',
  },
  {
    number: 7,
    name: 'Next step',
    purpose: 'Agree one concrete thing: a document on WhatsApp or email, a call at a named time, a meeting. One thing, named.',
    maySay: [
      '“Send the growth report on WhatsApp to this number, I will check.”',
      '“Let’s schedule a 15-minute Google Meet next Tuesday after 2 PM.”',
      '“Speak to our COO Suresh ji, take his direct number.”',
    ],
    events: [
      { id: 'google_meet', label: 'Agreed to Google Meet with founder' },
      { id: 'report_whatsapp', label: 'Agreed to report on WhatsApp' },
      { id: 'callback_named_time', label: 'Named specific callback time' },
      { id: 'referral_given', label: 'Referred to colleague with contact' },
    ],
    defaultOutcome: 'next_step_agreed',
  },
  {
    number: 8,
    name: 'Close',
    purpose: 'End the call clearly and record what happened: the outcome, the next step, and the prospect’s words from stage 5.',
    maySay: [
      '“Right, looking forward to Tuesday afternoon then. Thank you.”',
      '“Prospect disconnected / line dropped abruptly mid-sentence.”',
      '“A warm goodbye after a polite no.”',
    ],
    events: [
      { id: 'confirmed_warm_close', label: 'Confirmed next step & closed warmly' },
      { id: 'polite_close', label: 'Polite close after refusal' },
      { id: 'call_dropped', label: 'Call dropped / Abrupt hangup' },
      { id: 'do_not_call_request', label: 'Requested do not call' },
    ],
    defaultOutcome: 'completed',
  },
]

export const SAMPLE_CALLS = [
  {
    id: 'T001',
    prospect_name: 'Dev Sharma',
    company_name: 'Kalpana Chem Supplies',
    role: 'Technical Services Director',
    tag: 'T001 · Next step agreed (Google Meet)',
    notes: 'Agreed to 15-min Google Meet Tuesday 2pm with founder Vikram.',
    stage: 7,
  },
  {
    id: 'T010',
    prospect_name: 'Vinod Nair',
    company_name: 'ChromaChem India',
    role: 'Director',
    tag: 'T010 · Agreed to receive report on WhatsApp',
    notes: 'Send chemicals growth analysis on WhatsApp for review.',
    stage: 7,
  },
  {
    id: 'T007',
    prospect_name: 'R. K. Mehta',
    company_name: 'Udhav Textiles',
    role: 'Chief Executive Officer',
    tag: 'T007 · Not interested / Existing agency',
    notes: 'Already working with agency; not interested.',
    stage: 6,
  },
  {
    id: 'T003',
    prospect_name: 'Manpreet Singh',
    company_name: 'Novara Foods India',
    role: 'Associate Director',
    tag: 'T003 · Do not call',
    notes: 'Strict do-not-call request; multinational policy.',
    stage: 3,
  },
]

const DEMO_KEY = 'cold-call-guide-demo-calls-v3'
const isDemoEnv = import.meta.env.VITE_DEMO_MODE === 'true'
const apiBase = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '')

function uid() {
  return `call-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

function readDemoCalls() {
  try {
    const raw = localStorage.getItem(DEMO_KEY)
    if (raw) return JSON.parse(raw)
  } catch { }
  return [
    {
      id: 'demo-1',
      prospect_name: 'Dev Sharma',
      company_name: 'Kalpana Chem Supplies',
      status: 'completed',
      current_stage: 7,
      last_stage: 7,
      final_outcome: 'next_step_agreed',
      outcome: 'next_step_agreed',
      agreed_next_step: 'Google Meet Tuesday after 2 PM with Vikram',
      latest_note: 'Capacity running at 60%, looking for new export buyers.',
      ai_summary: 'Outcome: Next step agreed. Prospect Dev Sharma (Kalpana Chem) confirmed plant capacity at 60%. Agreed to Google Meet next Tuesday after 2 PM with Vikram.',
      created_at: new Date(Date.now() - 3600000).toISOString(),
      updated_at: new Date(Date.now() - 3600000).toISOString(),
      stage_results: [
        { stage_number: 1, event: 'reached_person', prospect_words: 'Aha, Priya ji, yes Dev speaking.', notes: '' },
        { stage_number: 2, event: 'let_caller_proceed', prospect_words: 'Yes, go ahead.', notes: '' },
        { stage_number: 5, event: 'growth_goal', prospect_words: 'We would have a clearer idea of our products and where to push them. Capacity is around 60%.', notes: '' },
        { stage_number: 7, event: 'google_meet', prospect_words: 'Tuesday is a good day. After 2 PM. Call us in the afternoon for a working session.', notes: '' },
      ],
    },
    {
      id: 'demo-2',
      prospect_name: 'Dr. Fernandes',
      company_name: 'Harbour Physio',
      status: 'completed',
      current_stage: 6,
      last_stage: 6,
      final_outcome: 'not_interested',
      outcome: 'not_interested',
      agreed_next_step: null,
      latest_note: 'Has existing agency, not interested.',
      ai_summary: 'Outcome: Not interested. Prospect Fernandes stated they already have an existing consultant and declined further outreach.',
      created_at: new Date(Date.now() - 7200000).toISOString(),
      updated_at: new Date(Date.now() - 7200000).toISOString(),
      stage_results: [
        { stage_number: 1, event: 'reached_person', prospect_words: 'Ha, tell me.', notes: '' },
        { stage_number: 2, event: 'guessed_sales_call', prospect_words: 'Is this a marketing call?', notes: '' },
        { stage_number: 6, event: 'already_has_agency', prospect_words: 'We already have an agency handling this, please don’t call.', notes: '' },
      ],
    },
  ]
}

function writeDemoCalls(calls) {
  try {
    localStorage.setItem(DEMO_KEY, JSON.stringify(calls))
  } catch { }
}

function normalizeCall(call = {}) {
  return {
    ...call,
    id: call.id || call.call_id,
    prospect_name: call.prospect_name || call.prospect || '',
    company_name: call.company_name || call.company || '',
    final_outcome: call.final_outcome || call.outcome || 'in_progress',
    outcome: call.outcome || call.final_outcome || 'in_progress',
    current_stage: Number(call.current_stage || call.last_stage || 1),
    last_stage: Number(call.last_stage || call.current_stage || 1),
    stage_results: call.stage_results || call.stages || [],
    ai_summary: call.ai_summary || call.summary || '',
  }
}

async function request(path, options = {}) {
  const res = await fetch(`${apiBase}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(data.detail || data.message || `Request failed (${res.status})`)
  }
  return data
}

function createCallDemo(payload) {
  const now = new Date().toISOString()
  const newCall = normalizeCall({
    id: uid(),
    ...payload,
    status: 'in_progress',
    current_stage: 1,
    last_stage: 1,
    outcome: null,
    started_at: now,
    created_at: now,
    updated_at: now,
    stage_results: [],
  })
  const list = readDemoCalls()
  writeDemoCalls([newCall, ...list])
  return newCall
}

function saveStageDemo(callId, stageNumber, data) {
  const list = readDemoCalls()
  const call = list.find((c) => c.id === callId)
  if (call) {
    const item = {
      id: uid(),
      call_id: callId,
      stage_number: stageNumber,
      event: data.event || 'not_logged',
      prospect_words: data.exact_words || '',
      notes: data.notes || '',
      created_at: new Date().toISOString(),
    }
    call.stage_results = [...(call.stage_results || []), item]
    call.current_stage = stageNumber
    call.last_stage = stageNumber
    call.latest_note = data.exact_words?.trim() || data.notes?.trim() || call.latest_note
    call.updated_at = new Date().toISOString()
    writeDemoCalls(list)
  }
  return { ok: true }
}

function closeCallDemo(callId, data) {
  const list = readDemoCalls()
  const call = list.find((c) => c.id === callId)
  const now = new Date().toISOString()
  const snapshot = {
    id: uid(),
    call_id: callId,
    stage_number: data.stage_number,
    event: data.event || 'not_logged',
    prospect_words: data.prospect_words || '',
    notes: data.notes || '',
    created_at: now,
  }
  const stageName = STAGES[(data.stage_number || 1) - 1]?.name || 'Call'
  const summary = `Outcome: ${prettyOutcome(data.outcome)}. Ended at ${stageName}. ${data.agreed_next_step ? `Agreed next step: ${data.agreed_next_step}.` : ''} Prospect words: "${data.prospect_words || 'None recorded'}"`
  if (call) {
    call.stage_results = [...(call.stage_results || []), snapshot]
    call.status = 'completed'
    call.outcome = data.outcome
    call.final_outcome = data.outcome
    call.agreed_next_step = data.agreed_next_step || null
    call.last_stage = data.stage_number
    call.current_stage = data.stage_number
    call.ended_at = now
    call.updated_at = now
    call.ai_summary = summary
    writeDemoCalls(list)
    return normalizeCall(call)
  }
  return normalizeCall({
    id: callId,
    status: 'completed',
    outcome: data.outcome,
    final_outcome: data.outcome,
    stage_results: [snapshot],
    ai_summary: summary,
  })
}

const api = {
  async health() {
    return request('/health')
  },
  async createCall(payload) {
    if (isDemoEnv) return createCallDemo(payload)
    try {
      return normalizeCall(await request('/calls', { method: 'POST', body: JSON.stringify(payload) }))
    } catch (err) {
      console.warn('Backend DB not connected, using resilient local persistence:', err.message)
      return createCallDemo(payload)
    }
  },
  async saveStage(callId, stageNumber, data) {
    if (isDemoEnv) return saveStageDemo(callId, stageNumber, data)
    try {
      return await request(`/calls/${encodeURIComponent(callId)}/stages`, {
        method: 'POST',
        body: JSON.stringify({
          stage_number: stageNumber,
          event: data.event || 'not_logged',
          prospect_words: data.exact_words || '',
          notes: data.notes || '',
        }),
      })
    } catch (err) {
      console.warn('Backend stage save fallback:', err.message)
      return saveStageDemo(callId, stageNumber, data)
    }
  },
  async closeCall(callId, data) {
    if (isDemoEnv) return closeCallDemo(callId, data)
    try {
      return normalizeCall(await request(`/calls/${encodeURIComponent(callId)}/close`, {
        method: 'POST',
        body: JSON.stringify(data),
      }))
    } catch (err) {
      console.warn('Backend close call fallback:', err.message)
      return closeCallDemo(callId, data)
    }
  },
  async listCalls() {
    if (isDemoEnv) return readDemoCalls().map(normalizeCall)
    try {
      const res = await request('/calls')
      const rows = Array.isArray(res) ? res : res.calls || []
      return rows.map(normalizeCall)
    } catch {
      return readDemoCalls().map(normalizeCall)
    }
  },
  async getCall(callId) {
    if (isDemoEnv) {
      const call = readDemoCalls().find((c) => c.id === callId)
      if (!call) throw new Error('Call not found in demo data.')
      return normalizeCall(call)
    }
    try {
      return normalizeCall(await request(`/calls/${encodeURIComponent(callId)}`))
    } catch {
      const call = readDemoCalls().find((c) => c.id === callId)
      if (call) return normalizeCall(call)
      throw new Error('Call not found.')
    }
  },
  async summarizeCall(callId) {
    if (isDemoEnv) {
      const list = readDemoCalls()
      const call = list.find((c) => c.id === callId)
      const summary = `Outcome: ${prettyOutcome(call?.outcome || 'closed')}. Prospect ${call?.prospect_name || 'Prospect'} (${call?.company_name || 'Company'}): Recorded need & next step accurately.`
      if (call) {
        call.ai_summary = summary
        writeDemoCalls(list)
      }
      return { ai_summary: summary }
    }
    return request(`/calls/${encodeURIComponent(callId)}/summary`, { method: 'POST' })
  },
  async suggestStage(words, currentStage) {
    try {
      return await request('/ai/suggest-stage', {
        method: 'POST',
        body: JSON.stringify({ words, current_stage: currentStage }),
      })
    } catch {
      // Local rule-based fallback
      const clean = (words || '').toLowerCase()
      if (clean.includes('agency') || clean.includes('consultant') || clean.includes('in-house')) {
        return { suggested_stage: 6, stage_name: 'Objection', suggested_event: 'already_has_agency', reason: 'Prospect mentioned existing agency/consultant.' }
      }
      if (clean.includes('meet') || clean.includes('zoom') || clean.includes('tuesday') || clean.includes('whatsapp')) {
        return { suggested_stage: 7, stage_name: 'Next step', suggested_event: clean.includes('meet') ? 'google_meet' : 'report_whatsapp', reason: 'Prospect agreed to concrete next step.' }
      }
      if (clean.includes('capacity') || clean.includes('export') || clean.includes('growth') || clean.includes('margins')) {
        return { suggested_stage: 5, stage_name: 'Their need, in their words', suggested_event: 'growth_goal', reason: 'Prospect described growth/capacity need.' }
      }
      return null
    }
  },
}

function formatTimer(seconds) {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export function App() {
  const [route, setRoute] = useState(() => (window.location.pathname === '/history' ? 'history' : 'live'))
  const [health, setHealth] = useState('checking')
  const [activeCall, setActiveCall] = useState(null)
  const [notice, setNotice] = useState('')

  useEffect(() => {
    api.health()
      .then(() => setHealth('online'))
      .catch(() => setHealth(isDemoEnv ? 'demo' : 'offline'))
  }, [])

  const navigate = (next) => {
    if (activeCall && next === 'history') {
      if (!confirm('You have an active live call in progress. Do you want to leave the screen? (Save or end the call to keep records)')) {
        return
      }
    }
    const path = next === 'history' ? '/history' : '/'
    window.history.pushState({}, '', path)
    setRoute(next)
    setNotice('')
  }

  return (
    <div className="callguide-root">
      {/* Top Header */}
      <header className="cg-topbar">
        <div className="cg-brand" onClick={() => navigate('live')}>
          <div className="brand-dot" />
          <span className="brand-title">Meridian Growth Partners</span>
          <span className="brand-pill">CALL GUIDE</span>
        </div>

        <nav className="cg-nav" aria-label="Main Navigation">
          <button
            className={`nav-tab ${route === 'live' ? 'active' : ''}`}
            onClick={() => navigate('live')}
            id="tab-live-call"
          >
            Live call screen
          </button>
          <button
            className={`nav-tab ${route === 'history' ? 'active' : ''}`}
            onClick={() => navigate('history')}
            id="tab-call-history"
          >
            Past calls & history
          </button>
        </nav>

        <div className="cg-top-meta">
          <span className={`status-badge ${health}`}>
            <span className="pulse-dot" />
            {health === 'online' ? 'Render API Live' : health === 'demo' ? 'Local Demo Mode' : 'Offline / Standalone'}
          </span>
        </div>
      </header>

      {notice && <div className="cg-banner" role="status">{notice}</div>}

      {/* Screen Body */}
      {route === 'history' ? (
        <HistoryScreen onStartCall={() => navigate('live')} />
      ) : (
        <LiveCallScreen
          activeCall={activeCall}
          setActiveCall={setActiveCall}
          onNotice={setNotice}
          onViewHistory={() => navigate('history')}
        />
      )}
    </div>
  )
}

function LiveCallScreen({ activeCall, setActiveCall, onNotice, onViewHistory }) {
  const [prospectName, setProspectName] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [prospectRole, setProspectRole] = useState('')
  const [stageIndex, setStageIndex] = useState(0)
  const [selectedEvent, setSelectedEvent] = useState('')
  const [prospectWords, setProspectWords] = useState('')
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [saving, setSaving] = useState(false)
  const [showEndModal, setShowEndModal] = useState(false)
  const [finalOutcome, setFinalOutcome] = useState('next_step_agreed')
  const [agreedNextStep, setAgreedNextStep] = useState('')
  const [closedCall, setClosedCall] = useState(null)
  const [aiSuggestion, setAiSuggestion] = useState(null)
  const [suggesting, setSuggesting] = useState(false)

  const currentStage = STAGES[stageIndex]
  const timerRef = useRef(null)

  // Timer while on call
  useEffect(() => {
    if (activeCall && !closedCall) {
      timerRef.current = setInterval(() => {
        setElapsedSeconds((s) => s + 1)
      }, 1000)
    } else {
      clearInterval(timerRef.current)
    }
    return () => clearInterval(timerRef.current)
  }, [activeCall, closedCall])

  // Sync stage draft when activeCall or stage changes
  useEffect(() => {
    if (!activeCall) return
    const stageResults = activeCall.stage_results || []
    const existing = [...stageResults].reverse().find((r) => Number(r.stage_number) === currentStage.number)
    if (existing) {
      setSelectedEvent(existing.event || '')
      setProspectWords(existing.prospect_words || existing.exact_words || '')
    } else {
      setSelectedEvent('')
      setProspectWords('')
    }
    setAiSuggestion(null)
  }, [stageIndex, activeCall])

  // Start Call Handler
  const handleStartCall = async (e) => {
    if (e) e.preventDefault()
    setSaving(true)
    try {
      const created = await api.createCall({
        prospect_name: prospectName.trim() || 'Prospect',
        company_name: companyName.trim() || 'Indian Enterprise',
      })
      setActiveCall({
        ...created,
        role: prospectRole.trim() || 'Director',
      })
      setStageIndex(0)
      setElapsedSeconds(0)
      setClosedCall(null)
      onNotice('Call connected. Stay on the structure and record prospect words.')
    } catch (err) {
      alert(`Could not start call: ${err.message}`)
    } finally {
      setSaving(false)
    }
  }

  // Pre-fill from sample transcript
  const loadSample = (sample) => {
    setProspectName(sample.prospect_name)
    setCompanyName(sample.company_name)
    setProspectRole(sample.role)
  }

  // Persist Current Stage
  const persistCurrentStage = async () => {
    if (!activeCall) return true
    try {
      await api.saveStage(activeCall.id, currentStage.number, {
        event: selectedEvent || 'not_logged',
        exact_words: prospectWords,
        notes: '',
      })
      setActiveCall((prev) => {
        if (!prev) return prev
        const filtered = (prev.stage_results || []).filter((r) => Number(r.stage_number) !== currentStage.number)
        return {
          ...prev,
          current_stage: currentStage.number,
          stage_results: [
            ...filtered,
            {
              stage_number: currentStage.number,
              event: selectedEvent || 'not_logged',
              prospect_words: prospectWords,
            },
          ],
        }
      })
      return true
    } catch (err) {
      console.error('Stage save error:', err)
      return false
    }
  }

  // Stage Navigation
  const goToStage = async (newIndex) => {
    if (newIndex === stageIndex || newIndex < 0 || newIndex >= STAGES.length) return
    setSaving(true)
    await persistCurrentStage()
    setSaving(false)
    setStageIndex(newIndex)
  }

  // AI Suggestion Handler
  const handleDetectStage = async () => {
    if (!prospectWords.trim()) return
    setSuggesting(true)
    try {
      const res = await api.suggestStage(prospectWords, currentStage.number)
      if (res && res.suggested_stage) {
        setAiSuggestion(res)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setSuggesting(false)
    }
  }

  // Apply AI Suggestion
  const applyAiSuggestion = async () => {
    if (!aiSuggestion) return
    const targetIdx = aiSuggestion.suggested_stage - 1
    if (targetIdx >= 0 && targetIdx < STAGES.length) {
      await persistCurrentStage()
      setStageIndex(targetIdx)
      if (aiSuggestion.suggested_event) {
        setSelectedEvent(aiSuggestion.suggested_event)
      }
      setAiSuggestion(null)
    }
  }

  // Open End Modal with Auto-inferred outcome
  const handleOpenEndModal = () => {
    let inferred = currentStage.defaultOutcome
    if (selectedEvent === 'google_meet' || selectedEvent === 'meeting_agreed') inferred = 'next_step_agreed'
    else if (selectedEvent === 'report_whatsapp' || selectedEvent === 'whatsapp_first') inferred = 'agreed_to_receive_report'
    else if (selectedEvent === 'already_has_agency' || selectedEvent === 'not_interested' || selectedEvent === 'declined') inferred = 'not_interested'
    else if (selectedEvent === 'wrong_contact' || selectedEvent === 'wrong_number') inferred = 'wrong_person'
    else if (selectedEvent === 'do_not_call_request') inferred = 'do_not_call'
    else if (selectedEvent === 'callback_named_time' || selectedEvent === 'callback_requested') inferred = 'call_again'
    setFinalOutcome(inferred)
    setShowEndModal(true)
  }

  // Confirm Close Call
  const handleConfirmClose = async () => {
    setSaving(true)
    try {
      const key = crypto.randomUUID()
      const closed = await api.closeCall(activeCall.id, {
        outcome: finalOutcome,
        stage_number: currentStage.number,
        event: selectedEvent || 'not_logged',
        prospect_words: prospectWords,
        notes: '',
        agreed_next_step: agreedNextStep.trim() || null,
        idempotency_key: key,
      })
      setClosedCall(closed)
      setActiveCall(null)
      setShowEndModal(false)
      onNotice('Call closed and saved. View summary below or open Call History.')
    } catch (err) {
      alert(`Could not end call: ${err.message}`)
    } finally {
      setSaving(false)
    }
  }

  // Render: Call Finished State
  if (closedCall) {
    return (
      <CallCompletedView
        call={closedCall}
        onStartNew={() => {
          setClosedCall(null)
          setActiveCall(null)
          setProspectName('')
          setCompanyName('')
          setProspectRole('')
          setStageIndex(0)
          setElapsedSeconds(0)
          setAgreedNextStep('')
        }}
        onViewHistory={onViewHistory}
      />
    )
  }

  // Render: Pre-call Launcher
  if (!activeCall) {
    return (
      <main className="cg-start-container">
        <div className="cg-start-card">
          <div className="card-badge">THE CALLER'S SCREEN · MERIDIAN GROWTH PARTNERS</div>
          <h1 className="start-title">Live Cold Call Guide</h1>
          <p className="start-subtitle">
            Keep this screen open beside your dialer. Work through all 8 stages, listen for what prospects say, tap what happened, and capture their exact words.
          </p>

          <form onSubmit={handleStartCall} className="cg-form">
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="input-prospect">Prospect Name</label>
                <input
                  id="input-prospect"
                  placeholder="e.g. Dev Sharma / Rajesh ji"
                  value={prospectName}
                  onChange={(e) => setProspectName(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="form-group">
                <label htmlFor="input-company">Company</label>
                <input
                  id="input-company"
                  placeholder="e.g. Kalpana Chem Supplies"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="input-role">Role / Designation (optional)</label>
              <input
                id="input-role"
                placeholder="e.g. Technical Services Director / Managing Director"
                value={prospectRole}
                onChange={(e) => setProspectRole(e.target.value)}
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary btn-large btn-block"
              disabled={saving}
              id="btn-start-call"
            >
              {saving ? 'Opening call guide…' : 'Start Live Call →'}
            </button>
          </form>

          {/* Quick-fill sample transcripts for camera demonstration */}
          <div className="cg-sample-transcripts">
            <p className="sample-label">⚡ Practice with a transcript call (from the 100 real calls):</p>
            <div className="sample-chips">
              {SAMPLE_CALLS.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className="sample-chip"
                  onClick={() => loadSample(s)}
                >
                  <strong>{s.id}</strong>: {s.prospect_name} ({s.company_name})
                </button>
              ))}
            </div>
          </div>
        </div>
      </main>
    )
  }

  // Render: Live Caller Workstation (Matching Reference Screen)
  const nextStageName = stageIndex < STAGES.length - 1 ? STAGES[stageIndex + 1].name : null

  return (
    <main className="cg-workspace">
      <div className="cg-caller-card">
        {/* Card Header: Company, Timer */}
        <div className="card-topbar">
          <span className="card-topbar-title">Meridian Growth Partners · call guide</span>
          <span className="live-timer" id="call-timer">
            <span className="timer-dot" />
            {formatTimer(elapsedSeconds)}
          </span>
        </div>

        {/* Prospect Details */}
        <div className="card-prospect-banner">
          <div className="prospect-info">
            <h2 className="prospect-name">{activeCall.prospect_name || 'Prospect'}</h2>
            <p className="prospect-meta">
              {activeCall.role ? `${activeCall.role}, ` : ''}{activeCall.company_name || 'Indian Enterprise'} · first call
            </p>
          </div>
          <div className="status-indicator">
            <span className="live-call-tag">ACTIVE CALL</span>
          </div>
        </div>

        {/* 8-Stage Progress Navigation Bar (Horizontal Tabs) */}
        <nav className="stage-tabs" aria-label="Call Stages">
          {STAGES.map((st, idx) => {
            const isCurrent = idx === stageIndex
            const isCompleted = idx < stageIndex
            return (
              <button
                key={st.number}
                type="button"
                className={`stage-tab ${isCurrent ? 'active' : ''} ${isCompleted ? 'done' : ''}`}
                onClick={() => goToStage(idx)}
                aria-label={`Stage ${st.number}: ${st.name}`}
                title={`Stage ${st.number}: ${st.name}`}
              >
                <span className="stage-tab-num">{isCompleted ? '✓' : st.number}</span>
                <span className="stage-tab-text">{st.name}</span>
              </button>
            )
          })}
        </nav>

        {/* Stage Content Surface */}
        <div className="card-body">
          <div className="stage-heading">
            <span className="stage-counter-text">Stage {currentStage.number} of 8</span>
            <h3 className="stage-name" id="current-stage-title">{currentStage.name}</h3>
            <p className="stage-purpose">{currentStage.purpose}</p>
          </div>

          {/* "Prospect may say" (3 Quotes) */}
          <div className="section-block">
            <span className="block-label">They may say</span>
            <ul className="quotes-list">
              {currentStage.maySay.map((quote, qIdx) => (
                <li key={qIdx} className="quote-item">
                  {quote}
                </li>
              ))}
            </ul>
          </div>

          {/* "What happened" (4 Taps Grid) */}
          <div className="section-block">
            <span className="block-label">What happened (tap one)</span>
            <div className="taps-grid" role="group" aria-label="Stage outcomes">
              {currentStage.events.map((ev) => {
                const isSelected = selectedEvent === ev.id
                return (
                  <button
                    key={ev.id}
                    type="button"
                    className={`tap-btn ${isSelected ? 'selected' : ''}`}
                    onClick={() => setSelectedEvent(ev.id)}
                    aria-pressed={isSelected}
                  >
                    {ev.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* "Their words" (Only free text box on the screen) */}
          <div className="section-block">
            <div className="words-label-row">
              <span className="block-label">Their words (write what they said)</span>
              {prospectWords.length > 5 && (
                <button
                  type="button"
                  className="btn-ai-detect"
                  onClick={handleDetectStage}
                  disabled={suggesting}
                >
                  {suggesting ? 'Analyzing…' : '✨ AI Stage Suggest'}
                </button>
              )}
            </div>
            <textarea
              id="box-prospect-words"
              className="words-textarea"
              placeholder="e.g. “accounting for what, we already have a CA who files everything”"
              rows={3}
              value={prospectWords}
              onChange={(e) => setProspectWords(e.target.value)}
              aria-label="Prospect exact words"
            />

            {/* AI Suggestion Banner if detected */}
            {aiSuggestion && (
              <div className="ai-suggestion-box">
                <div className="ai-suggestion-content">
                  <span className="ai-tag">💡 AI Stage Suggestion</span>
                  <p className="ai-reason">
                    <strong>Stage {aiSuggestion.suggested_stage} ({aiSuggestion.stage_name})</strong>: {aiSuggestion.reason}
                  </p>
                </div>
                <button
                  type="button"
                  className="btn btn-ai-apply"
                  onClick={applyAiSuggestion}
                >
                  Jump to Stage {aiSuggestion.suggested_stage} →
                </button>
              </div>
            )}
          </div>

          {/* Bottom Actions */}
          <div className="card-actions">
            {stageIndex > 0 && (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => goToStage(stageIndex - 1)}
                disabled={saving}
              >
                ← Prev
              </button>
            )}

            {nextStageName ? (
              <button
                type="button"
                className="btn btn-primary btn-next"
                onClick={() => goToStage(stageIndex + 1)}
                disabled={saving}
                id="btn-next-stage"
              >
                {saving ? 'Saving…' : `Next: ${nextStageName} →`}
              </button>
            ) : (
              <button
                type="button"
                className="btn btn-primary btn-next"
                onClick={handleOpenEndModal}
                disabled={saving}
                id="btn-finish-call"
              >
                Complete & Close Call →
              </button>
            )}

            <button
              type="button"
              className="btn btn-danger-ghost"
              onClick={handleOpenEndModal}
              id="btn-end-call"
            >
              End call
            </button>
          </div>
        </div>
      </div>

      {/* End Call Outcome Modal */}
      {showEndModal && (
        <div className="modal-overlay" role="presentation">
          <div className="modal-dialog" role="dialog" aria-modal="true" aria-labelledby="modal-title">
            <h3 id="modal-title">Save & End Call</h3>
            <p className="modal-desc">
              Ending from <strong>Stage {currentStage.number}: {currentStage.name}</strong>. Calls can end at any stage. Select the outcome and confirm agreed next steps.
            </p>

            <div className="form-group">
              <label>Final Call Outcome</label>
              <div className="outcomes-grid">
                {[
                  ['next_step_agreed', 'Next step agreed (Meeting/Date)'],
                  ['agreed_to_receive_report', 'Agreed to receive report (WhatsApp)'],
                  ['interested', 'Interested (No fixed next step)'],
                  ['follow_up', 'Follow-up needed'],
                  ['call_again', 'Call again (Line/Busy)'],
                  ['not_interested', 'Not interested / Declined'],
                  ['do_not_call', 'Do not call / Remove'],
                  ['wrong_person', 'Wrong person / Left company'],
                  ['moved_company', 'Moved company'],
                  ['not_logged', 'Not logged'],
                ].map(([val, label]) => (
                  <button
                    key={val}
                    type="button"
                    className={`outcome-select-btn ${finalOutcome === val ? 'selected' : ''}`}
                    onClick={() => setFinalOutcome(val)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="agreed-step">Agreed Next Step (one concrete commitment)</label>
              <input
                id="agreed-step"
                placeholder="e.g. Google Meet next Tuesday after 2 PM with Vikram"
                value={agreedNextStep}
                onChange={(e) => setAgreedNextStep(e.target.value)}
              />
            </div>

            <div className="modal-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowEndModal(false)}
              >
                Keep call open
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleConfirmClose}
                disabled={saving}
                id="btn-save-close"
              >
                {saving ? 'Saving to Supabase…' : 'Save & Record Call'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}

function CallCompletedView({ call, onStartNew, onViewHistory }) {
  const [summary, setSummary] = useState(call.ai_summary || '')
  const [loadingSummary, setLoadingSummary] = useState(false)

  const stageReached = STAGES[Math.max(0, (call.last_stage || call.current_stage || 1) - 1)]

  const handleRegenerate = async () => {
    setLoadingSummary(true)
    try {
      const res = await api.summarizeCall(call.id)
      setSummary(res.ai_summary)
    } catch (err) {
      alert(`Could not regenerate summary: ${err.message}`)
    } finally {
      setLoadingSummary(false)
    }
  }

  return (
    <main className="cg-completed-container">
      <div className="cg-completed-card">
        <div className="completed-check">✓</div>
        <span className="card-badge">CALL RECORD SAVED TO SUPABASE</span>
        <h2 className="completed-title">{call.prospect_name}</h2>
        <p className="completed-meta">{call.company_name} · Stage reached: <strong>{stageReached?.name}</strong></p>

        <div className="completed-details">
          <div className="detail-item">
            <span className="detail-label">Outcome</span>
            <span className="outcome-pill active">{prettyOutcome(call.outcome || call.final_outcome)}</span>
          </div>
          {call.agreed_next_step && (
            <div className="detail-item">
              <span className="detail-label">Agreed Next Step</span>
              <p className="detail-val-highlight">{call.agreed_next_step}</p>
            </div>
          )}
        </div>

        {/* AI 1-line CRM Summary Card */}
        <div className="ai-summary-card">
          <div className="ai-summary-header">
            <span className="ai-badge">✨ AI 1-Line CRM Summary</span>
            <button
              type="button"
              className="btn-link"
              onClick={handleRegenerate}
              disabled={loadingSummary}
            >
              {loadingSummary ? 'Refreshing…' : '↻ Regenerate Summary'}
            </button>
          </div>
          <p className="ai-summary-text">
            {summary || 'Drafting summary from prospect words and outcome…'}
          </p>
        </div>

        <div className="completed-actions">
          <button type="button" className="btn btn-primary" onClick={onStartNew} id="btn-start-another">
            Start Another Call →
          </button>
          <button type="button" className="btn btn-secondary" onClick={onViewHistory} id="btn-view-history">
            View in Past Calls
          </button>
        </div>
      </div>
    </main>
  )
}

function HistoryScreen({ onStartCall }) {
  const [calls, setCalls] = useState([])
  const [selectedCall, setSelectedCall] = useState(null)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')

  const fetchCalls = useCallback(async () => {
    setLoading(true)
    try {
      const data = await api.listCalls()
      setCalls(data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchCalls()
  }, [fetchCalls])

  const filteredCalls = useMemo(() => {
    const q = filter.toLowerCase().trim()
    if (!q) return calls
    return calls.filter((c) =>
      (c.prospect_name || '').toLowerCase().includes(q) ||
      (c.company_name || '').toLowerCase().includes(q) ||
      (c.outcome || c.final_outcome || '').toLowerCase().includes(q)
    )
  }, [calls, filter])

  const openCallDetails = async (call) => {
    setSelectedCall({ ...call, loading: true })
    try {
      const full = await api.getCall(call.id)
      setSelectedCall(full)
    } catch {
      setSelectedCall(call)
    }
  }

  return (
    <main className="cg-history-container">
      <div className="history-header-row">
        <div>
          <span className="card-badge">SECOND SCREEN · PAST CALLS</span>
          <h1 className="history-title">Call Records & Outcomes</h1>
          <p className="history-subtitle">
            A list of calls for the caller to see where their calls end. Review prospect words and agreed next steps.
          </p>
        </div>
        <button type="button" className="btn btn-primary" onClick={onStartCall}>
          + Start New Call
        </button>
      </div>

      <div className="history-search-bar">
        <input
          type="search"
          placeholder="Search by prospect, company, or outcome…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="search-input"
        />
        <button type="button" className="btn btn-secondary" onClick={fetchCalls} disabled={loading}>
          {loading ? 'Refreshing…' : '↻ Refresh'}
        </button>
      </div>

      {loading && calls.length === 0 ? (
        <div className="history-loading">Loading saved calls from Supabase…</div>
      ) : filteredCalls.length === 0 ? (
        <div className="history-empty">
          <p>No calls found.</p>
          <button type="button" className="btn btn-primary" onClick={onStartCall}>
            Start your first call
          </button>
        </div>
      ) : (
        <div className="history-content-layout">
          {/* Reference Screen Past Calls List */}
          <div className="reference-calls-list" role="list">
            {filteredCalls.map((c) => {
              const stageReached = STAGES[(c.last_stage || c.current_stage || 1) - 1]?.name || 'Opening'
              const noteText = c.ai_summary || c.agreed_next_step || c.latest_note || 'No notes logged'
              const isSelected = selectedCall?.id === c.id

              return (
                <div
                  key={c.id}
                  className={`reference-call-row ${isSelected ? 'selected' : ''}`}
                  onClick={() => openCallDetails(c)}
                  role="listitem"
                  tabIndex={0}
                >
                  <div className="call-row-main">
                    <p className="call-row-prospect">
                      {c.prospect_name || 'Prospect'}, {c.company_name || 'Enterprise'}
                    </p>
                    <p className="call-row-note">{noteText}</p>
                  </div>
                  <div className="call-row-meta">
                    <span className="call-row-stage">{stageReached}</span>
                    <span className="call-row-time">{formatRelativeTime(c.updated_at || c.created_at)}</span>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Drawer / Detail Panel */}
          {selectedCall && (
            <aside className="call-detail-drawer" aria-label="Call Detail">
              <div className="drawer-header">
                <div>
                  <span className="card-badge">CALL DETAILS</span>
                  <h3 className="drawer-prospect">{selectedCall.prospect_name || 'Prospect'}</h3>
                  <p className="drawer-company">{selectedCall.company_name || 'Company'}</p>
                </div>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setSelectedCall(null)}
                  aria-label="Close"
                >
                  ✕
                </button>
              </div>

              <div className="drawer-summary-pill">
                <span>Final Outcome:</span>
                <strong>{prettyOutcome(selectedCall.outcome || selectedCall.final_outcome)}</strong>
              </div>

              {selectedCall.agreed_next_step && (
                <div className="drawer-section">
                  <span className="drawer-label">Agreed Next Step</span>
                  <p className="drawer-next-step">{selectedCall.agreed_next_step}</p>
                </div>
              )}

              {/* AI Summary */}
              {selectedCall.ai_summary && (
                <div className="drawer-section ai-section">
                  <span className="drawer-label">✨ AI Call Summary</span>
                  <p className="drawer-ai-text">{selectedCall.ai_summary}</p>
                </div>
              )}

              {/* Stage by stage results */}
              <div className="drawer-section">
                <span className="drawer-label">Stages Visited & Prospect Words</span>
                <div className="stage-timeline">
                  {(selectedCall.stage_results || []).length === 0 ? (
                    <p className="empty-sub">No intermediate stages were saved.</p>
                  ) : (
                    selectedCall.stage_results.map((r, i) => {
                      const st = STAGES[(r.stage_number || 1) - 1]
                      return (
                        <div key={i} className="timeline-node">
                          <div className="node-badge">Stage {r.stage_number}</div>
                          <div className="node-body">
                            <strong>{st?.name || 'Stage'}</strong> · <em>{prettyOutcome(r.event)}</em>
                            {r.prospect_words && (
                              <blockquote className="node-words">“{r.prospect_words}”</blockquote>
                            )}
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              </div>
            </aside>
          )}
        </div>
      )}
    </main>
  )
}

function prettyOutcome(val = '') {
  return String(val)
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase()) || 'Not Logged'
}

function formatRelativeTime(dateStr) {
  if (!dateStr) return 'Today'
  try {
    const d = new Date(dateStr)
    const now = new Date()
    const isToday = d.toDateString() === now.toDateString()
    const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    return isToday ? `Today ${time}` : `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })} ${time}`
  } catch {
    return 'Recent'
  }
}

createRoot(document.getElementById('root')).render(<App />)
