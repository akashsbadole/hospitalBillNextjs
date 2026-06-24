import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { apiGet } from '@/lib/api-client'

export interface Branch {
  id: string
  branchId: string
  name: string
  code: string
  city?: string | null
  isHead: boolean
  status: string
}

interface BranchState {
  branches: Branch[]
  selectedBranchId: string | null // null = all branches
  loading: boolean
  fetchBranches: () => Promise<void>
  selectBranch: (branchId: string | null) => void
}

export const useBranchStore = create<BranchState>()(
  persist(
    (set) => ({
      branches: [],
      selectedBranchId: null,
      loading: false,

      fetchBranches: async () => {
        set({ loading: true })
        try {
          const res = await apiGet<{ data: Branch[] }>('/branches', { all: 'true' })
          set({ branches: res.data, loading: false })
        } catch {
          set({ loading: false })
        }
      },

      selectBranch: (branchId: string | null) => {
        set({ selectedBranchId: branchId })
      },
    }),
    {
      name: 'medibill-branch',
      partialize: (state) => ({ selectedBranchId: state.selectedBranchId }),
    }
  )
)
