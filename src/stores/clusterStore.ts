import { create } from 'zustand'
import { ClusterConfig } from '../types'

interface ClusterStore {
  clusters: ClusterConfig[]
  activeClusterId: string | null
  loadClusters: () => Promise<void>
  addCluster: (config: ClusterConfig) => Promise<void>
  removeCluster: (name: string) => Promise<void>
  setActiveCluster: (name: string | null) => void
}

export const useClusterStore = create<ClusterStore>((set, get) => ({
  clusters: [],
  activeClusterId: null,

  loadClusters: async () => {
    const clusters = await window.electronAPI.config.list()
    const current = get().activeClusterId
    set({
      clusters,
      activeClusterId: clusters.find(c => c.name === current)?.name ?? clusters[0]?.name ?? null
    })
  },

  addCluster: async (config) => {
    await window.electronAPI.config.save(config)
    await get().loadClusters()
  },

  removeCluster: async (name) => {
    await window.electronAPI.config.delete(name)
    const { activeClusterId } = get()
    if (activeClusterId === name) {
      set({ activeClusterId: null })
    }
    await get().loadClusters()
  },

  setActiveCluster: (name) => {
    set({ activeClusterId: name })
  }
}))