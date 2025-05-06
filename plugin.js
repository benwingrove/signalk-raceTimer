const path = require('path')
const express = require('express')

module.exports = function (app) {
  let plugin = {}
  let targetTime = null

  plugin.id = 'signalk-raceTimer'
  plugin.name = 'Race Timer Plugin'

  plugin.start = function (options, restartPlugin) {
    const router = express.Router()
    const staticDir = path.join(__dirname, 'static')

    app.debug('Race Timer plugin starting...')

    router.use('/', express.static(staticDir))
    app.registerPluginRoute(plugin.id, '', router)

    app.registerPutHandler('signalk-raceTimer', '/setTargetTime', (req, res) => {
      try {
        const timeStr = req.body.time
        targetTime = new Date(timeStr)
        if (isNaN(targetTime.getTime())) throw new Error('Invalid date/time format')
        res.status(200).send({ status: 'ok', targetTime: targetTime.toISOString() })
      } catch (e) {
        res.status(400).send({ status: 'error', message: e.message })
      }
    })

    app.subscriptionmanager.subscribe(
      {
        context: 'vessels.self',
        subscribe: [{ path: 'navigation.datetime' }]
      },
      (delta) => {
        if (!targetTime) return
        const gpsTimeStr = delta.updates?.[0]?.values?.[0]?.value
        if (!gpsTimeStr) return

        const gpsTime = new Date(gpsTimeStr)
        const diffMs = targetTime - gpsTime
        const diffSeconds = Math.floor(diffMs / 1000)

        app.handleMessage(plugin.id, {
          updates: [
            {
              values: [
                {
                  path: 'notifications.raceTimer.timeToStart',
                  value: diffSeconds
                }
              ],
              timestamp: new Date().toISOString()
            }
          ]
        })
      }
    )
  }

  plugin.stop = function () {
    app.debug('Race Timer plugin stopped')
  }

  return plugin
}
