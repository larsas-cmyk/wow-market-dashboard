export type MarketStatus = 'focus' | 'maintain' | 'watch' | 'speculate' | 'review' | 'drop'
export type GraduationStage = 'testing' | 'proven' | 'graduated' | 'review'
export type EarnedGraduationStage = 'testing' | 'proven' | 'graduated'

export interface MarketItem {
  id: string
  name: string
  marginPct: number
  latestTurnoverPct: number
  previousTurnoverPct: number
  successfulCycles: number
  lowTurnoverCycles: number
  targetReductionCount: number
  everGraduated: boolean
  earnedGraduationStage: EarnedGraduationStage
  reviewStage: Exclude<EarnedGraduationStage, 'testing'> | null
  acquisitionPerDay: number
  stock: number
  targetStock: number
  lastChecked: string
  status: MarketStatus
  notes: string
}