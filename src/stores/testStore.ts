import { create } from 'zustand'
import { TestType, TestStep, TestStatus, EnhancedTestResult } from '../types'

interface TestStore {
  testType: TestType
  scale: number
  status: TestStatus
  currentStep: TestStep | null
  result: EnhancedTestResult | null
  setTestType: (type: TestType) => void
  setScale: (scale: number) => void
  setStatus: (status: TestStatus) => void
  setCurrentStep: (step: TestStep | null) => void
  setResult: (result: EnhancedTestResult | null) => void
}

export const useTestStore = create<TestStore>((set) => ({
  testType: 'ssb',
  scale: 1,
  status: 'idle',
  currentStep: null,
  result: null,

  setTestType: (type) => set({ testType: type, result: null }),
  setScale: (scale) => set({ scale }),
  setStatus: (status) => set({ status }),
  setCurrentStep: (step) => set({ currentStep: step }),
  setResult: (result) => set({ result })
}))