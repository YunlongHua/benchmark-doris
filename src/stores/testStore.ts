import { create } from 'zustand'
import { TestType, TestStep, TestStatus, TestResult } from '../types'

interface TestStore {
  testType: TestType
  scale: number
  status: TestStatus
  currentStep: TestStep | null
  result: TestResult | null
  setTestType: (type: TestType) => void
  setScale: (scale: number) => void
  setStatus: (status: TestStatus) => void
  setCurrentStep: (step: TestStep | null) => void
  setResult: (result: TestResult | null) => void
  startTest: () => Promise<void>
  stopTest: () => Promise<void>
  runStep: (step: TestStep) => Promise<void>
}

export const useTestStore = create<TestStore>((set, get) => ({
  testType: 'ssb',
  scale: 1,
  status: 'idle',
  currentStep: null,
  result: null,

  setTestType: (type) => set({ testType: type, result: null }),
  setScale: (scale) => set({ scale }),
  setStatus: (status) => set({ status }),
  setCurrentStep: (step) => set({ currentStep: step }),
  setResult: (result) => set({ result }),

  startTest: async () => {
    const { testType, scale } = get()
    const clusterId = ''
    set({ status: 'running' })
    try {
      await window.electronAPI.test.start({ testType, scale, clusterId })
      set({ status: 'success' })
    } catch (err) {
      set({ status: 'error' })
      throw err
    }
  },

  stopTest: async () => {
    await window.electronAPI.test.stop()
    set({ status: 'idle', currentStep: null })
  },

  runStep: async (step) => {
    const { testType, scale } = get()
    set({ status: 'running', currentStep: step })
    try {
      await window.electronAPI.test.runStep({ step, testType, scale, clusterId: '' })
      set({ status: 'success' })
    } catch {
      set({ status: 'error' })
    }
  }
}))