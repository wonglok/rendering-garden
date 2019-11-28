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

let makeScene = () => {
  const THREE = require('three')
  var scene = new THREE.Scene();
  return scene
}

let makeCamera = ({ scene, width, height }) => {
  const THREE = require('three')
  const VIEW_ANGLE = 75
  const ASPECT = width / height
  const NEAR = 0.1
  const FAR = 10000000000000
  var camera = new THREE.PerspectiveCamera(VIEW_ANGLE, ASPECT, NEAR, FAR)
  camera.position.set(0, 0, 50)
  camera.lookAt(scene.position)
  return camera
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

let getID = () => {
  return `_${(Math.random() * 10000000).toFixed(0)}`
}

let makeBox = async ({ tasks, scene, camera, web }) => {
  const id = getID()
  const THREE = require('three')
  const path = require('path')
  web.notify('loading texture....')
  let { texture, width, height } = await loadTexture({ file: path.join(__dirname, './img/139-1920x1920.jpg') })
  let glsl = v => v[0]
  let geo = new THREE.SphereBufferGeometry(50, 128, 128)
  let mat = new THREE.ShaderMaterial({
    uniforms: {
      time: { value: 0 },
      tex: { value: texture }
    },
    vertexShader: glsl`
      #include <common>
      varying vec2 vUv;
      uniform float time;
      void main (void) {
        vUv = uv;
        vec3 nPos = position;
        nPos.x += sin(nPos.y * 0.1 + time * 10.0) * 2.0;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(nPos, 1.0);
      }
    `,
    fragmentShader: glsl`
      varying vec2 vUv;
      uniform sampler2D tex;
      uniform float time;

      void main (void) {
        vec4 color = texture2D(tex, vUv);
        // color.r *= abs(sin(time));
        gl_FragColor = vec4(color.rgb + 0.32,color.a);
      }
    `,
    // color: 0xff00ff,
    // wireframe: true,
    side: THREE.DoubleSide
  })

  let mesh = new THREE.Mesh(geo, mat)
  mesh.position.z = -camera.position.z
  mesh.scale = 1.0
  mesh.scale = 1.0
  mesh.scale = 1.0
  scene.add(mesh)

  tasks[id] = ({ clock, delta }) => {
    mat.uniforms.time.value = clock * 0.0001
    mesh.rotation.x += delta * 0.0001
  }

  return {
    mesh
  }
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
    createOnePic({
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
      if (msg === 'start') {
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
let webShim = {
  pushImage: () => {},
  notify: () => {}
}


const visibleHeightAtZDepth = (depth, camera) => {
  // compensate for cameras not positioned at z=0
  const cameraOffset = camera.position.z
  if (depth < cameraOffset) depth -= cameraOffset
  else depth += cameraOffset

  // vertical fov in radians
  const vFOV = camera.fov * Math.PI / 180

  // Math.abs to ensure the result is always positive
  return 2 * Math.tan(vFOV / 2) * Math.abs(depth)
}

const visibleWidthAtZDepth = (depth, camera) => {
  const height = visibleHeightAtZDepth(depth, camera)
  return height * camera.aspect
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

let makeTextMaterial = () => {
  let THREE = require('three')
  let glsl = v => v[0]
  let mat = new THREE.ShaderMaterial({
    transparent: true,
    uniforms: {
      time: { value: 0 },
      tex: { value: null }
    },
    vertexShader: glsl`
      #include <common>
      varying vec2 vUv;
      uniform float time;
      void main (void) {
        vUv = uv;
        vec3 nPos = position;
        nPos.z += sin(nPos.x * 0.1 + time * 10.0) * 2.0;

        gl_Position = projectionMatrix * modelViewMatrix * vec4(nPos, 1.0);
      }
    `,
    fragmentShader: glsl`
      varying vec2 vUv;
      uniform sampler2D tex;
      uniform float time;

      void main (void) {
        vec4 color = texture2D(tex, vUv);
        // color.r *= abs(sin(time));
        // float avg = (color.r + color.b + color.g) / 3.0;
        gl_FragColor = vec4(color.rgb, color.a);
      }
    `,
    // color: 0xff00ff,
    // wireframe: true,
    side: THREE.DoubleSide
  })
  return mat
}

let getCanvasWords = async ({ width, height, scene, camera, tasks, web }) => {
  let id = getID()
  let THREE = require('three')
  let sleep = (t) => new Promise(resolve => setTimeout(resolve, t))
  var opentype = require('opentype.js')
  let makeCanvasTexture = async () => {
    /* eslint-disable */
    var Canvas = eval('require')('canvas')
    // Canvas.registerFont('./shared/font/RalewayThin.ttf', { family: 'Raleway' })
    /* eslint-enable */

    let drawText = require('node-canvas-text').default
    var canvas = Canvas.createCanvas(width, height)
    canvas.width = width
    canvas.height = height

    var ctx = canvas.getContext('2d')

    let area = {
      x: width * 0.1,
      y: height * 0.1,
      width: width * 0.8,
      height: height * 0.8
    }
    let style = {
      minSize: 5,
      maxSize: 200,
      granularity: 4,
      hAlign: 'center',
      vAlign: 'center',
      fitMethod: 'box',
      textFillStyle: 'rgba(0,0,0,1.0)',
      rectFillStyle: 'rgba(255,255,255,0.0)',
      rectFillOnlyText: true,
      textPadding: 20,
      fillPadding: 20,
      drawRect: false
    }
    ctx.imageSmoothingEnabled = true

    ctx.fillStyle = 'rgba(255,255,255,0.0)'
    ctx.fillRect(0, 0, width, height)

    // let titleFont = opentype.loadSync(__dirname + '/fonts/NotoSansCJKtc-hinted/notosanscjktc_regular.otf');
    let titleFont = opentype.loadSync(__dirname + '/fonts/PTN57F.ttf');
    let titleString = `How are you? I'm fine thank you!`;
    drawText(ctx, titleString, titleFont, area, style);

    return nodeCanvasToTexture(canvas)
  }

  web.notify('drawing text....')
  let widthGeo = visibleWidthAtZDepth(0, camera)
  let geo = new THREE.PlaneBufferGeometry(widthGeo, widthGeo, 20, 20)
  // let mat = makeTextMaterial()
  let mat = new THREE.MeshBasicMaterial({
    map: await makeCanvasTexture(),
    transparent: true
  })
  // mat.uniforms.tex.value = await makeCanvasTexture()
  let mesh = new THREE.Mesh(geo, mat)
  mesh.scale.x = 1.0
  mesh.scale.y = 1.0
  scene.add(mesh)
  scene.background = new THREE.Color('#ffffff')

  tasks[id] = ({ clock }) => {
    // mat.uniforms.time.value = clock
  }
}

let createOnePic = async ({ web = webShim }) => {
  let core = {
    fps: 30,
    width: 1080,
    height: 1080,
    videoDuration: 0.5,
    previewFolder: 'public/preview',
    tasks: {}
  }
  core.scene = makeScene()
  core.scene.rotation.z = Math.PI * -0.5
  core.scene.scale.x = -1
  core.camera = makeCamera({ ...core })
  core.renderAPI = makeEngine({ ...core })
  core.boxAPI = await makeBox({ ...core, web })
  core.words = await getCanvasWords({ ...core, web })
  core.computeTasks = ({ clock, delta }) => {
    for (var kn in core.tasks) {
      core.tasks[kn]({ clock, delta })
    }
  }

  var clockNow = 0;
  // const SECONDS_OF_VIDEO = core.videoDuration || 1
  const FPS_FIXED = core.fps
  const DELTA = (1000 / FPS_FIXED);
  // const TOTAL_FRAMES = SECONDS_OF_VIDEO * FPS_FIXED;
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
  let core = {
    fps: 34.56,
    width: 1080,
    height: 1080,
    videoDuration: 15,
    previewFolder: 'public/preview',
    tasks: {}
  }

  core.scene = makeScene()
  core.camera = makeCamera({ ...core })
  core.renderAPI = makeEngine({ ...core })
  core.boxAPI = await makeBox({ ...core, web })
  core.words = await getCanvasWords({ ...core, web })
  core.computeTasks = ({ clock, delta }) => {
    for (var kn in core.tasks) {
      core.tasks[kn]({ clock, delta })
    }
  }

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
    web.notify(`Video is ready. <video autoplay loop controls target="_blank" width="720" src="/preview/${newFilename}">${newFilename}</video>`)
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
