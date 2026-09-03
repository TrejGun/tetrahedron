'use strict'

const http = require('http')

const resources = new Map([
  [1, { id: 1, name: 'Conference Room A', kind: 'room',    capacity: 8,  timezone: 'Europe/Lisbon' }],
  [2, { id: 2, name: 'GPU Workstation 1', kind: 'gpu',     capacity: 1,  timezone: 'UTC' }],
  [3, { id: 3, name: 'Van #4',            kind: 'vehicle', capacity: 9,  timezone: 'America/New_York' }],
  [5, { id: 5, name: 'Conference Room B', kind: 'room',    capacity: 12, timezone: 'Europe/Lisbon' }],
  [7, { id: 7, name: 'Roof Terrace',      kind: 'room',    capacity: 30, timezone: 'Asia/Tokyo' }]
])

const ERRORS = 6
const MALFORMED = 8
const SLOW = 7
const SLOW_MS = 5000

const server = http.createServer((req, res) => {
  if (req.method !== 'GET') {
    res.statusCode = 405
    return void res.end()
  }
  const match = req.url.match(/^\/(\d+)$/)
  if (!match) {
    res.statusCode = 400
    return void res.end()
  }
  const id = Number(match[1])

  const respond = () => {
    if (ERRORS === id) {
      res.statusCode = 500
      return void res.end()
    }
    if (MALFORMED === id) {
      res.setHeader('Content-Type', 'application/json')
      return void res.end('{"id":' + id + ',"name":')
    }
    const resource = resources.get(id)
    if (!resource) {
      res.statusCode = 404
      return void res.end()
    }
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify(resource))
  }

  if (SLOW === id) setTimeout(respond, SLOW_MS)
  else respond()
})

const port = process.env.PORT || 4040
server.listen(port, () => {
  console.log('catalog listening on port ' + server.address().port)
})
