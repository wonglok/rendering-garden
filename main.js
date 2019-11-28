const THREE = require('three')
const path = require('path')
const Shared = require('./public/js/shared.js')
var CanvasTextWrapper = require('canvas-text-wrapper').CanvasTextWrapper;

const webShim = Shared.webShim
const drawText = Shared.drawText
const makeCore = Shared.makeCore
const defineCore = Shared.defineCore

let makeEngine = ({ camera, scene, width, height }) => {
  const THREE = require('three');
  const createContext = require('gl')
  const api = {}
  const gl = createContext(width, height, {
    preserveDrawingBuffer: true,
    antialias: true
  })
  let _getExtension = gl.getExtension
  gl.getExtension = (v) => {
    if (v === 'STACKGL_destroy_context') {
      var ext = _getExtension('STACKGL_destroy_context')
      return ext
    }
    return true
  };

  const canvas = {
    getContext () {
      return gl
    },
    addEventListener () {
    }
  };

  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    width: 0,
    height: 0,
    canvas: canvas,
    context: gl
  });

  const rtTexture = new THREE.WebGLRenderTarget(width, height, {
    minFilter: THREE.LinearFilter,
    magFilter: THREE.NearestFilter,
    format: THREE.RGBAFormat
  });

  api.destory = () => {
    const ext = gl.getExtension('STACKGL_destroy_context')
    ext.destroy()
  }

  api.render = () => {
    renderer.setRenderTarget(rtTexture);
    renderer.render(scene, camera);

    const gl = renderer.getContext();
    const pixels = new Uint8Array(4 * width * height);
    gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

    return {
      pixels
    }
  }

  return api
}


var LRU = require("lru-cache")
var options = {
  max: 500,
  maxAge: 1000 * 60 * 60
}
let TextureCache = new LRU(options)
let loadTexture = ({ file }) => {
  return new Promise((resolve, reject) => {
    if (TextureCache.has(file)) {
      resolve(TextureCache.get(file))
      return
    }
    const THREE = require('three')
    var getPixels = require('get-pixels')
    getPixels(file, (err, pixels) => {
      if (err) {
        console.log('Bad image path')
        reject(err)
        return
      }

      let info = pixels.shape
      console.log('got pixels', info)

      let texture = new THREE.DataTexture(pixels.data, info[0], info[1], info[2] === 4 ? THREE.RGBAFormat : THREE.RGBFormat)
      texture.needsUpdate = true
      let output = {
        width: info[0],
        height: info[1],
        texture
      }
      TextureCache.set(file, output)
      resolve(output)
    })
  })
}


let makeWebServer = () => {
  let express = require('express');
  var app = express();
  var http = require('http').Server(app);
  var io = require('socket.io')(http);
  var port = process.env.PORT || 3123;

  app.get('/', function(req, res){
    res.sendFile(__dirname + '/public/index.html');
  });

  app.use(express.static('public'))
  app.get('/img', (req, res) => {
    createScreenShot({
      web: {
        notify: (msg) => {
          io.emit('chat message', `${msg}`);
        },
        pushImage: (data) => {
          data.stream.pipe(res)
        }
      }
    })
  })

  io.on('connection', function(socket){
    socket.on('chat message', function(msg){
      io.emit('chat message', msg);
    });

    socket.on('chat message', async (msg) => {
      if (msg === 'video') {
        // console.log('made a engine')
        let videoAPI = await makeVideoAPI({
          web: {
            notify: (msg) => {
              io.emit('chat message', `${msg}`);
            },
            pushImage: () => {}
          }
        })
        videoAPI.start()
      }
      if (msg === 'pic') {
        io.emit('chat message', `<img src="/img" style="max-width: 100%" onload="window.scrollBottom" alt="image">`)
      }
    })
    // socket.once('disconnect', () => {
    //   console.log('disconnect')
    // })
  });

  http.listen(port, function(){
    console.log('listening on *:' + port);
  });

  return {
    io
  }
}
let nodeCanvasToTexture = (canvas) => {
  var THREE = require('three')
  var buf = canvas.toBuffer('raw')
  var ab = new ArrayBuffer(buf.length)
  var view = new Uint8Array(ab)
  for (var i = 0; i < buf.length; ++i) {
    view[i] = buf[i]
  }
  return new THREE.DataTexture(ab, canvas.width, canvas.height, THREE.RGBAFormat)
}


let makeTitleText = async ({ width, height }) => {
  /* eslint-disable */
  var Canvas = eval('require')('canvas')
  Canvas.registerFont('./public/fonts/NotoSansCJKtc-notscript/NotoSansCJKtc-Thin.otf', { family: 'NotoSans' })
  /* eslint-enable */
  var canvas = Canvas.createCanvas(width, height)
  drawText({ CanvasTextWrapper, canvas, width, height })
  return nodeCanvasToTexture(canvas)
}

let fsReadTexture = async ({ core }) => {
  let Texture = {}
  Texture.leafBG = (await loadTexture({ file: path.join(__dirname, './public/img/139-1920x1920.jpg') })).texture
  Texture.text = await makeTitleText({ width: core.width, height: core.height })
  return Texture
}

let createScreenShot = async ({ web = webShim }) => {
  let core = await defineCore({ THREE, makeEngine })
  let Texture = await fsReadTexture({ core })
  core = await makeCore({ core, Texture, web })

  core.scene.scale.y = -1
  core.scene.rotation.z = Math.PI * 0.5

  var clockNow = 0;
  // const SECONDS_OF_VIDEO = core.videoDuration || 1
  const FPS_FIXED = core.fps
  const DELTA = (1000 / FPS_FIXED);
  core.computeTasks({ clock: clockNow, delta: DELTA })
  const { pixels } = core.renderAPI.render()
  // const combined = Buffer.from(pixels)
  let ndarray = require('ndarray')
  let savePixels = require('save-pixels')
  let stream = savePixels(ndarray(pixels, [core.width, core.height, 4]), 'png', { quality: 60 });

  web.pushImage({
    width: core.width,
    height: core.width,
    stream
  });
  core.renderAPI.destory()
}

let makeVideoAPI = async ({ web = webShim }) => {
  let core = await defineCore({ THREE, makeEngine })
  let Texture = await fsReadTexture({ core })
  core = await makeCore({ core, web, Texture })

  const path = require('path');
  const os = require('os');
  const fs = require('fs');
  const Encoder = require('./vid.encoder.js')

  const temp = os.tmpdir()
  const filename = './tempvid.mp4'
  const onDone = ({ output }) => {
    web.notify('Video is online....')
    let newFilename = `_${(Math.random() * 10000000).toFixed(0)}.mp4`
    let newfile = path.join(__dirname, core.previewFolder, newFilename)

    web.notify(`<a class="link-box" target="_blank" href="/preview/${newFilename}">/preview/${newFilename}</a>`)
    web.notify(`<video autoplay loop controls class="video-box" src="/preview/${newFilename}">${newFilename}</video>`)
    fs.rename(output, newfile, (err) => {
      if (err) throw err;
      console.log('file is at:', newfile);
      // fs.unlinkSync(output)
      console.log(`https://video-encoder.wonglok.com/preview/${newFilename}`)
      console.log('cleanup complete!');
      // encoder.kill()
    });
  }
  const encoder = new Encoder({
    output: path.join(temp, filename),
    width: core.width,
    height: core.height,
    fps: core.fps,
    onDone
  });
  // encoder.promise.then(onDone);
  // encoder.on('console', (evt) => {
  //   // console.log(evt)
  // });
  // encoder.on('done', (evt) => {
  //   web.notify('Finished encoding video....')
  // });

  var abort = false
  var i = -1;
  var clockNow = 0;
  const SECONDS_OF_VIDEO = core.videoDuration || 1
  const FPS_FIXED = core.fps
  const DELTA = (1000 / FPS_FIXED);
  const TOTAL_FRAMES = SECONDS_OF_VIDEO * FPS_FIXED;

  const repeat = () => {
    i++;
    const now = (i - 1) < 0 ? 0 : (i - 1)
    const progress = {
      at: now.toFixed(0),
      total: TOTAL_FRAMES.toFixed(0),
      progress: (now / TOTAL_FRAMES).toFixed(4)
    }

    console.log('progress', progress)
    web.notify(`Progress: ${((now / TOTAL_FRAMES) * 100).toFixed(2).padStart(6, '0')}%, ${now.toFixed(0).padStart(6, '0')} / ${TOTAL_FRAMES.toFixed(0).padStart(6, '0')} Frames Processed`);

    clockNow += DELTA
    core.computeTasks({ clock: clockNow, delta: DELTA })
    const { pixels } = core.renderAPI.render()
    const combined = Buffer.from(pixels);
    encoder.passThrough.write(combined, () => {
      if (i > TOTAL_FRAMES || abort) {
        web.notify('Begin packing video');
        encoder.passThrough.end();
        process.nextTick(() => {
          core.renderAPI.destory();
        });
      } else {
        setTimeout(repeat, 0);
      }
    })
  }

  return {
    start () {
      repeat()
    },
    abort () {
      abort = true
    }
  }
}

makeWebServer()
