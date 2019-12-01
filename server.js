const Graphics = require('./src/gl-api/graphics.js')

let makeWebServer = () => {
  let express = require('express')
  var app = express()
  var http = require('http').Server(app)
  var io = require('socket.io')(http)
  var port = process.env.PORT || 3123
  var path = require('path')

  console.log(port)



  app.use('/preview', express.static('preview'))
  app.use('/resource', express.static('resource'))
  app.get('/img', (req, res) => {
    let str = req.query.json || encodeURIComponent(JSON.stringify({
      text: 'some random text',
      bg: (Math.random() * 0xffffff)
    }))
    try {
      let obj = JSON.parse(decodeURIComponent(str))
      createScreenShot({
        data: obj,
        web: {
          pushVideo: () => {
          },
          notify: (msg) => {
            io.emit('log', { id: Graphics.getID(),  html: `${msg}` })
          },
          pushImage: (data) => {
            data.stream.pipe(res)
            setTimeout(() => {
              io.emit('log', { id: Graphics.getID(),  html: `loaded` })
            }, 1000)
          }
        }
      })
    } catch (e) {
      res.json({
        error: 'bad json'
      })
    }
  })

  const webpack = require('webpack')
  const middleware = require('webpack-dev-middleware')
  const compiler = webpack({
    mode: 'development',
    // webpack options
    entry: './src/gl-api/main-front-end.js',
    output: {
      filename: './v1/sdk.js',
      path: path.resolve(__dirname, 'dist')
    }
  })

  app.use(middleware(compiler, {

  }))
  app.get('/*', function (req, res) {
    res.sendFile(path.join(__dirname, '/src/html/index.html'))
  })

  io.on('connection', function (socket) {
    socket.on('chat', function (msg) {
      io.emit('log', { id: Graphics.getID(), html: msg })
    })

    socket.on('make pic', (data) => {
      io.emit('log', { id: Graphics.getID(), html: `<img src="/img?json=${encodeURIComponent(JSON.stringify(data))}" style="max-width: 100%" onload="window.scrollBottom" alt="image">` })
    })
    socket.on('make video', async (data) => {
      let videoAPI = await makeVideoAPI({
        data,
        web: {
          notify: (msg) => {
            io.emit('log', { id: Graphics.getID(), html: `${msg}` })
          },
          progress: (data) => {
            io.emit('progress', data)
          },
          pushImage: () => {}
        }
      })
      videoAPI.start()
      socket.on('disconnect', () => {
        videoAPI.abort()
      })
    })
  })

  http.listen(port, function () {
    console.log('listening on *:' + port)
  })

  return {
    io
  }
}

let createScreenShot = async ({ data, web = Graphics.webShim }) => {
  let core = await Graphics.generateCore({ web, spec: data })

  core.scene.scale.y = -1
  core.scene.rotation.z = Math.PI * 0.5

  var clockNow = 0
  // const SECONDS_OF_VIDEO = core.videoDuration || 1
  const FPS_FIXED = core.fps
  const DELTA = (1000 / FPS_FIXED)
  core.computeTasks({ clock: clockNow, delta: DELTA })
  const { pixels } = core.renderAPI.render()
  // const combined = Buffer.from(pixels)
  let ndarray = require('ndarray')
  let savePixels = require('save-pixels')
  let stream = savePixels(ndarray(pixels, [core.width, core.height, 4]), 'png', { quality: 60 })

  web.pushImage({
    width: core.width,
    height: core.width,
    stream
  })

  core.clean()
  core.renderAPI.destory()

  return {
    updateData (v) {
      core.data = v
    }
  }
}

let makeVideoAPI = async ({ data, web = Graphics.webShim }) => {
  let core = await Graphics.generateCore({ web, spec: data })

  const path = require('path')
  const os = require('os')
  const fs = require('fs')
  const Encoder = require('./src/encoder/vid.encoder.js')

  const temp = os.tmpdir()
  const filename = './tempvid.mp4'
  const onDone = ({ output }) => {
    let newFilename = `_${(Math.random() * 10000000).toFixed(0)}.mp4`
    let newfile = path.join(__dirname, core.previewFolder, newFilename)

    web.notify(`<a class="link-box" target="_blank" href="${core.previewFolder}${newFilename}">/preview/${newFilename}</a>`)
    web.notify(`<video autoplay loop controls class="video-box" playsinline src="${core.previewFolder}${newFilename}">${newFilename}</video>`)
    fs.rename(output, newfile, (err) => {
      if (err) throw err
      console.log('file is at:', newfile)
      // fs.unlinkSync(output)
      console.log(`https://video-encoder.wonglok.com${core.previewFolder}${newFilename}`)
      // web.pushVideo(newfile)
      core.clean()
      core.renderAPI.destory()
      console.log('cleanup complete!')
      // encoder.kill()
    })
  }
  const encoder = new Encoder({
    output: path.join(temp, filename),
    width: core.width,
    height: core.height,
    fps: core.fps,
    onDone
  })

  // encoder.promise.then(onDone)
  // encoder.on('console', (evt) => {
  //   // console.log(evt)
  // })
  // encoder.on('done', (evt) => {
  //   web.notify('Finished encoding video....')
  // })

  var abort = false
  var i = -1
  var clockNow = 0
  const SECONDS_OF_VIDEO = core.videoDuration || 1
  const FPS_FIXED = core.fps
  const DELTA = (1000 / FPS_FIXED)
  const TOTAL_FRAMES = SECONDS_OF_VIDEO * FPS_FIXED

  const repeat = () => {
    i++
    const now = (i - 1) < 0 ? 0 : (i - 1)
    const progress = {
      at: now.toFixed(0),
      total: TOTAL_FRAMES.toFixed(0),
      percentage: (now / TOTAL_FRAMES).toFixed(4),
      progress: (now / TOTAL_FRAMES).toFixed(6)
    }

    console.log('progress', progress)
    // web.notify(`Motion Graphics Process Progress: ${((now / TOTAL_FRAMES) * 100).toFixed(2).padStart(6, '0')}%, ${now.toFixed(0).padStart(6, '0')} / ${TOTAL_FRAMES.toFixed(0).padStart(6, '0')}`)

    web.progress(progress)

    clockNow += DELTA
    core.computeTasks({ clock: clockNow, delta: DELTA })
    const { pixels } = core.renderAPI.render()
    const combined = Buffer.from(pixels)
    encoder.passThrough.write(combined, () => {
      if (i > TOTAL_FRAMES || abort) {
        web.notify('Begin packing video')
        encoder.passThrough.end()
        // process.nextTick(() => {
        // })
      } else {
        setTimeout(repeat, 0)
      }
    })
  }

  return {
    updateData (data) {
      return core.data = data
    },
    start () {
      repeat()
      web.notify('Begin.....')
    },
    abort () {
      core.clean()
      abort = true
    }
  }
}

makeWebServer()
