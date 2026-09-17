import { createServerFn } from '@tanstack/react-start'
import { EMPTY_HEADER_DATA, loadHeaderData, type HeaderData } from './header-data'

export const getHeaderData = createServerFn({ method: 'GET' }).handler(
  async (): Promise<HeaderData> => {
    try {
      return await loadHeaderData()
    } catch (error) {
      console.error('[root] failed to load header data', error)
      return EMPTY_HEADER_DATA
    }
  },
)
