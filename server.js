const Shared = require('./src/gl-api/shared.js')

let makeWebServer = () => {
  let express = require('express')
  var app = express()
  var http = require('http').Server(app)
  var io = require('socket.io')(http)
  var port = process.env.PORT || 3123
  var path = require('path')

  app.get('/', function (req, res) {
    res.sendFile(path.join(__dirname, '/resource/index.html'))
  })

  app.use('/resource', express.static('resource'))
  app.get('/img', (req, res) => {
    createScreenShot({
      data: {
        text: req.query.text || `some random text`
      },
      web: {
        pushVideo: () => {
        },
        notify: (msg) => {
          io.emit('chat message', `${msg}`)
        },
        pushImage: (data) => {
          data.stream.pipe(res)
        }
      }
    })
  })

  // app.get('/video', async (req, res) => {
  //   let api = await makeVideoAPI({
  //     data: {
  //       text: req.query.text || `some random text`
  //     },
  //     web: {
  //       pushVideo: (videoFile) => {
  //         res.sendFile(videoFile)
  //       },
  //       notify: (msg) => {
  //         io.emit('chat message', `${msg}`)
  //       },
  //       pushImage: () => {
  //       }
  //     }
  //   })
  //   api.start()
  // })

  const webpack = require('webpack')
  const middleware = require('webpack-dev-middleware')
  const compiler = webpack({
    mode: 'development',
    // webpack options
    entry: './src/gl-api/main-front-end.js',
    output: {
      filename: './dist/bundle.js',
      path: path.resolve(__dirname, 'dist')
    }
  })
  app.use(
    middleware(compiler, {
      // webpack-dev-middleware options
    })
  )

  // app.use(proxy('localhost:8080'))

  io.on('connection', function (socket) {
    socket.on('chat message', function (msg) {
      io.emit('chat message', msg)
    })

    socket.on('chat message', async (msg) => {
      if (msg.indexOf('video') === 0) {
        // console.log('made a engine')
        let videoAPI = await makeVideoAPI({
          data: {
            text: msg.slice(6, msg.length).trim()
          },
          web: {
            notify: (msg) => {
              io.emit('chat message', `${msg}`)
            },
            pushImage: () => {}
          }
        })
        videoAPI.start()
      }

      if (msg.indexOf('pic') === 0) {
        io.emit('chat message', `<img src="/img?text=${encodeURIComponent(msg.slice(3, msg.length).trim())}" style="max-width: 100%" onload="window.scrollBottom" alt="image">`)
      }
    })
    // socket.once('disconnect', () => {
    //   console.log('disconnect')
    // })
  })

  http.listen(port, function () {
    console.log('listening on *:' + port)
  })

  return {
    io
  }
}

let createScreenShot = async ({ data, web = Shared.webShim }) => {
  let core = await Shared.generateCore({ web, data })

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
}

let makeVideoAPI = async ({ data, web = Shared.webShim }) => {
  let core = await Shared.generateCore({ data, web })

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
      progress: (now / TOTAL_FRAMES).toFixed(4)
    }

    console.log('progress', progress)
    web.notify(`Video Process Progress: ${((now / TOTAL_FRAMES) * 100).toFixed(2).padStart(6, '0')}%, ${now.toFixed(0).padStart(6, '0')} / ${TOTAL_FRAMES.toFixed(0).padStart(6, '0')} Motion Graphics Frame Processed`)

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
        process.nextTick(repeat, 0)
      }
    })
  }

  return {
    start () {
      repeat()
    },
    abort () {
      core.clean()
      abort = true
    }
  }
}

makeWebServer()
