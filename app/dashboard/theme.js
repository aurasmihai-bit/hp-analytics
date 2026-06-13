'use client'

import { C } from './components'

export const THEME_STORAGE_KEY = 'hp_dashboard_theme'

export const LIGHT_THEME = {
  '--hp-bg':'#f5f5f3',
  '--hp-card':'#ffffff',
  '--hp-input':'#ffffff',
  '--hp-border':'#e8e8e0',
  '--hp-text':'#1a1a18',
  '--hp-muted':'#666660',
  '--hp-hint':'#999990',
  '--hp-navy':'#1A2B4A',
  '--hp-blue':'#3B82C4',
  '--hp-green':'#16A34A',
  '--hp-amber':'#D97706',
  '--hp-red':'#DC2626',
  '--hp-gray':'#6B7280',
  '--hp-purple':'#7C3AED',
  '--hp-teal':'#0891B2',
  '--hp-soft-blue':'#EBF4FC',
  '--hp-soft-green':'#F0FDF4',
  '--hp-soft-amber':'#FFF7ED',
  '--hp-soft-red':'#FEF2F2',
  '--hp-soft-panel':'#F5F5F3',
}

export const DARK_THEME = {
  '--hp-bg':'#0f172a',
  '--hp-card':'#111827',
  '--hp-input':'#0b1220',
  '--hp-border':'#273449',
  '--hp-text':'#f8fafc',
  '--hp-muted':'#cbd5e1',
  '--hp-hint':'#94a3b8',
  '--hp-navy':'#2563eb',
  '--hp-blue':'#60a5fa',
  '--hp-green':'#4ade80',
  '--hp-amber':'#fbbf24',
  '--hp-red':'#f87171',
  '--hp-gray':'#94a3b8',
  '--hp-purple':'#a78bfa',
  '--hp-teal':'#2dd4bf',
  '--hp-soft-blue':'#10243d',
  '--hp-soft-green':'#102a1b',
  '--hp-soft-amber':'#33250b',
  '--hp-soft-red':'#351616',
  '--hp-soft-panel':'#162033',
}

export function ThemeSwitch({ darkMode, onToggle }) {
  return (
    <button
      onClick={onToggle}
      aria-pressed={darkMode}
      title={darkMode ? 'Treci pe light mode' : 'Treci pe dark mode'}
      style={{
        height:28,minWidth:62,padding:3,border:`0.5px solid ${C.border}`,borderRadius:999,
        background:darkMode?'#020617':C.softPanel,cursor:'pointer',display:'flex',alignItems:'center',
        justifyContent:darkMode?'flex-end':'flex-start',transition:'all .18s ease',
      }}
    >
      <span style={{
        width:22,height:22,borderRadius:'50%',background:darkMode?'#f8fafc':'#ffffff',
        boxShadow:'0 1px 4px rgba(0,0,0,.18)',display:'flex',alignItems:'center',justifyContent:'center',
        color:darkMode?'#0f172a':'#f59e0b',fontSize:12,lineHeight:1,
      }}>{darkMode?'●':'○'}</span>
    </button>
  )
}
