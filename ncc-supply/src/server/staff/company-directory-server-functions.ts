import { createServerFn } from '@tanstack/react-start'
import { db } from '../db/client'
import { requireStaffActor } from './staff-session'
import { listCompaniesForStaff, type StaffCompanySummary } from './company-directory'

export const listStaffCompanies = createServerFn({ method: 'GET' }).handler(
  async (): Promise<StaffCompanySummary[]> => {
    const actor = await requireStaffActor(db)
    return listCompaniesForStaff(db, actor)
  },
)
