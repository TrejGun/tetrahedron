'use strict'

const http = require('http')

const db = new Map()
let nextId = 1

const hydrate = (record) => {
  const id = nextId++
  db.set(id, { id, ...record })
}

hydrate({ resourceId: 1, holder: 'alice@example.com', startsAt: '2026-06-01T09:00:00Z', endsAt: '2026-06-01T10:00:00Z' })
hydrate({ resourceId: 1, holder: 'bob@example.com',   startsAt: '2026-06-01T11:00:00Z', endsAt: '2026-06-01T12:00:00Z' })
hydrate({ resourceId: 2, holder: 'carol@example.com', startsAt: '2026-06-02T14:00:00Z', endsAt: '2026-06-02T16:00:00Z' })
hydrate({ resourceId: 3, holder: 'dave@example.com',  startsAt: '2026-06-03T08:00:00Z', endsAt: '2026-06-03T17:00:00Z' })
hydrate({ resourceId: 5, holder: 'erin@example.com',  startsAt: '2026-06-04T13:00:00Z', endsAt: '2026-06-04T14:00:00Z' })

const ERRORS = 7
const MALFORMED = 6
const SLOW = 2
const SLOW_MS = 5000

const readBody = (req) => new Promise((resolve, reject) => {
  let raw = ''
  req.setEncoding('utf8')
  req.on('data', (chunk) => { raw += chunk })
  req.on('end', () => {
    if (raw === '') return resolve({})
    try { resolve(JSON.parse(raw)) } catch (err) { reject(err) }
  })
  req.on('error', reject)
})

const json = (res, status, body) => {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(body))
}

const empty = (res, status) => {
  res.statusCode = status
  res.end()
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost')
    const idMatch = url.pathname.match(/^\/(\d+)$/)
    const id = idMatch ? Number(idMatch[1]) : null

    if (req.method === 'GET' && url.pathname === '/') {
      const resourceId = url.searchParams.get('resourceId')
      let items = [...db.values()]
      if (resourceId !== null && resourceId !== '') {
        items = items.filter((r) => String(r.resourceId) === resourceId)
      }
      return void json(res, 200, items)
    }

    if (req.method === 'GET' && id !== null) {
      if (ERRORS === id) return void empty(res, 500)
      if (MALFORMED === id) {
        res.setHeader('Content-Type', 'application/json')
        return void res.end('{"id":' + id + ',"holder":')
      }
      const respond = () => {
        const record = db.get(id)
        if (!record) return void empty(res, 404)
        json(res, 200, record)
      }
      if (SLOW === id) setTimeout(respond, SLOW_MS)
      else respond()
      return
    }

    if (req.method === 'POST' && url.pathname === '/') {
      const body = await readBody(req)
      const newId = nextId++
      const record = {
        id: newId,
        resourceId: body.resourceId,
        holder: body.holder,
        startsAt: body.startsAt,
        endsAt: body.endsAt
      }
      db.set(newId, record)
      return void json(res, 201, record)
    }

    if (req.method === 'PUT' && id !== null) {
      const body = await readBody(req)
      const record = {
        id,
        resourceId: body.resourceId,
        holder: body.holder,
        startsAt: body.startsAt,
        endsAt: body.endsAt
      }
      db.set(id, record)
      return void json(res, 200, record)
    }

    if (req.method === 'PATCH' && id !== null) {
      const existing = db.get(id)
      if (!existing) return void empty(res, 404)
      const body = await readBody(req)
      const record = { ...existing, ...body, id }
      db.set(id, record)
      return void json(res, 200, record)
    }

    if (req.method === 'DELETE' && id !== null) {
      if (!db.has(id)) return void empty(res, 404)
      db.delete(id)
      return void empty(res, 204)
    }

    empty(res, 400)
  } catch (err) {
    empty(res, 500)
  }
})

const port = process.env.PORT || 5050
server.listen(port, () => {
  console.log('reservations listening on port ' + server.address().port)
})
