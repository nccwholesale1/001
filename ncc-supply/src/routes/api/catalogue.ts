import { createFileRoute } from '@tanstack/react-router'
import { loadHomeCatalogue } from '../../server/catalogue/home-data'

export const Route = createFileRoute('/api/catalogue')({
  server: {
    handlers: {
      GET: async () => {
        const data = await loadHomeCatalogue()
        return Response.json(data)
      },
    },
  },
})
