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
    const filtered = get().logs
    if (filtered.length > 10000) {
      filtered.splice(0, 1000)
    }
    set({
      logs: [...filtered, { id: logId++, line, level, timestamp: new Date().toISOString() }]
    })
  },

  clearLogs: () => set({ logs: [] }),
  setAutoScroll: (auto) => set({ autoScroll: auto })
}))