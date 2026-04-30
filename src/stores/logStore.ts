import { create } from 'zustand'
import { LogLevel } from '../types'

export interface LogEntry {
  id: number
  line: string
  level: LogLevel
  timestamp: string
}

interface LogStore {
  logs: LogEntry[]
  autoScroll: boolean
  addLog: (line: string, level: LogLevel) => void
  clearLogs: () => void
  setAutoScroll: (auto: boolean) => void
}

let logId = 0

export const useLogStore = create<LogStore>((set, get) => ({
  logs: [],
  autoScroll: true,

  addLog: (line, level) => {
    // Trim trailing newlines from SSH stream chunks to prevent blank lines
    const trimmed = line.replace(/[\r\n]+$/, '')
    if (!trimmed) return

    const filtered = get().logs
    if (filtered.length > 10000) {
      filtered.splice(0, 1000)
    }
    const now = new Date()
    const pad = (n: number) => String(n).padStart(2, '0')
    const localTime = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`
    set({
      logs: [...filtered, { id: logId++, line: trimmed, level, timestamp: localTime }]
    })
  },

  clearLogs: () => set({ logs: [] }),
  setAutoScroll: (auto) => set({ autoScroll: auto })
}))