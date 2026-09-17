import { createServerFn } from '@tanstack/react-start'
import { debugSessionLog } from '../debug-session-log'
import { EMPTY_HEADER_DATA, loadHeaderData, type HeaderData } from './header-data'

export const getHeaderData = createServerFn({ method: 'GET' }).handler(
  async (): Promise<HeaderData> => {
    // #region agent log
    debugSessionLog({
      location: 'src/server/layout/header-data-server-functions.ts:getHeaderData',
      message: 'getHeaderData handler entered',
      hypothesisId: 'D',
      data: { hasWindow: typeof window !== 'undefined' },
    })
    // #endregion
    try {
      return await loadHeaderData()
    } catch (error) {
      // #region agent log
      debugSessionLog({
        location: 'src/server/layout/header-data-server-functions.ts:getHeaderData',
        message: 'loadHeaderData threw',
        hypothesisId: 'D',
        data: {
          name: error instanceof Error ? error.name : typeof error,
          errorMessage: error instanceof Error ? error.message : String(error),
        },
      })
      // #endregion
      console.error('[root] failed to load header data', error)
      return EMPTY_HEADER_DATA
    }
  },
)
