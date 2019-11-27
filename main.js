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

let loadTexture = ({ file }) => {
  return new Promise((resolve, reject) => {
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
      resolve({
        width: info[0],
        height: info[1],
        texture
      })
    })
  })
}

let getID = () => {
  return `_${(Math.random() * 10000000).toFixed(0)}`
}

let makeBox = async ({ tasks, scene, web }) => {
  const id = getID()
  const THREE = require('three')
  const path = require('path')
  web.notify('loading texture....')
  let { texture, width, height } = await loadTexture({ file: path.join(__dirname, './img/nirmal-rajendharkumar-FMwrQjB0q-U-unsplash.jpg') })
  let glsl = v => v[0]
  let geo = new THREE.SphereBufferGeometry(30, 64, 64)
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
        color.r *= abs(sin(time));
        gl_FragColor = vec4(color);
      }
    `,
    // color: 0xff00ff,
    // wireframe: true,
    side: THREE.DoubleSide
  })

  let mesh = new THREE.Mesh(geo, mat)
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

  io.on('connection', function(socket){
    console.log('connected')
    socket.on('chat message', function(msg){
      io.emit('chat message', msg);
    });

    socket.on('chat message', async (msg) => {
      if (msg === 'start') {
        console.log('made a engine')
        let videoAPI = await makeVideoAPI({
          web: {
            notify: (msg) => {
              io.emit('chat message', `${msg}`);
            }
          }
        })
        videoAPI.start()
      }
    })
    socket.once('disconnect', () => {
      console.log('disconnect')
    })
  });

  http.listen(port, function(){
    console.log('listening on *:' + port);
  });

  return {
    io
  }
}
let webShim = {
  notify: () => {}
}

let makeVideoAPI = async ({ web = webShim }) => {
  let core = {
    fps: 30,
    width: 720,
    height: 720,
    videoLength: 3,
    previewFolder: 'public/preview',
    tasks: {}
  }
  core.scene = makeScene()
  core.camera = makeCamera({ ...core })
  core.renderAPI = makeEngine({ ...core })
  core.boxAPI = await makeBox({ ...core, web })
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
  const encoder = new Encoder({ output: path.join(temp, filename), width: core.width, height: core.height, fps: core.fps });
  encoder.promise.then(({ output }) => {
    web.notify('Video is online....')
    let newFilename = `_${(Math.random() * 10000000).toFixed(0)}.mp4`
    let newfile = path.join(__dirname, core.previewFolder, newFilename)
    fs.rename(output, newfile, (err) => {
      if (err) throw err;
      console.log('file is at:', newfile);

      web.notify(`Video is ready. <a target="_blank" href="/preview/${newFilename}">Generated Video File: ${newFilename}</a>`)
      // fs.unlinkSync(output)
      console.log('cleanup complete!');
      // encoder.kill()
    });
  });
  // encoder.on('console', (evt) => {
  //   // console.log(evt)
  // });
  encoder.on('done', (evt) => {
    web.notify('Finished encoding video....')
  });

  var abort = false
  var i = -1;
  var clockNow = 0;
  const SECONDS_OF_VIDEO = core.videoLength || 1
  const FPS_FIXED = core.fps
  const DELTA = (1000 / FPS_FIXED);
  const total = SECONDS_OF_VIDEO * FPS_FIXED;

  const repeat = () => {
    i++;
    const now = (i - 1) < 0 ? 0 : (i - 1)
    const progress = {
      at: now.toFixed(0),
      total: total.toFixed(0),
      progress: (now / total).toFixed(4)
    }

    console.log('progress', progress)
    web.notify(`Progress: ${((now / total) * 100).toFixed(2).padStart(6, '0')}%, ${now.toFixed(0).padStart(6, '0')} / ${total.toFixed(0).padStart(6, '0')} Frames Compiled`);

    clockNow += DELTA
    core.computeTasks({ clock: clockNow, delta: DELTA })
    const { pixels } = core.renderAPI.render()
    const combined = Buffer.from(pixels);
    encoder.passThrough.write(combined, () => {
      if (i > total || abort) {
        encoder.passThrough.end();
        process.nextTick(() => {
          core.renderAPI.destory();
        });
      } else {
        process.nextTick(repeat);
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
