let makeEngine = ({ camera, scene, width, height }) => {
  const THREE = require('three');
  const createContext = require('gl')
  const api = {}
  const gl = createContext(width, height, {
    preserveDrawingBuffer: true,
    // antialias: true
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
    // antialias: true,
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

let makeBox = ({ tasks, scene }) => {
  const THREE = require('three')

  let geo = new THREE.SphereBufferGeometry(30, 64, 64)
  let mat = new THREE.MeshBasicMaterial({
    color: 0xff00ff,
    wireframe: true,
    side: THREE.DoubleSide
  })

  let mesh = new THREE.Mesh(geo, mat)
  scene.add(mesh)

  tasks.box = ({ clock, delta }) => {
    mesh.rotation.x += delta * 0.0001
  }

  return {
    mesh
  }
}

let makeWebServer = ({ core }) => {
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

    socket.on('chat message', (msg) => {
      if (msg === 'start') {
        console.log('made a engine')
        core.renderAPI = makeEngine({ ...core })
        let videoAPI = core.makeVideoAPI({
          core,
          onFinalising: () => {
            io.emit('chat message', `
              Finalising Video... Please wait....
            `);
          },
          onDone: ({ file, filename }) => {
            io.emit('chat message', `
              <a target="_blank" href="/preview/${filename}">${filename}</a>
            `);
          },
          onLog: ({ at, total, progress }) => {
            io.emit('chat message', `Progress: ${(progress * 100).toFixed(2)}%`);
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

let makeVideoAPI = ({ core, onDone = () => {}, onFinalising = () => {}, onLog = () => {} }) => {
  const path = require('path');
  const os = require('os');
  const fs = require('fs');
  const Encoder = require('./vid.encoder.js')

  const temp = os.tmpdir()
  const filename = './tempvid.mp4'
  const encoder = new Encoder({ output: path.join(temp, filename) });
  encoder.promise.then(({ output }) => {
    onFinalising({})
    let newFilename = `_${(Math.random() * 10000000).toFixed(0)}.mp4`
    let newfile = path.join(__dirname, core.previewFolder, newFilename)
    fs.copyFile(output, newfile, (err) => {
      if (err) throw err;
      console.log('file is at:', newfile);
      fs.unlinkSync(output)
      console.log('cleanup complete!');
      // encoder.kill()
      onDone({ file: newfile, filename: newFilename })
    });
  });
  // encoder.on('console', (evt) => {
  //   // console.log(evt)
  // });
  encoder.on('done', (evt) => {
    onFinalising({})
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
    onLog(progress)

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

let makeCinematicEngine = () => {
  let Tests = {}

  let core = {
    fps: 30,
    width: 720,
    height: 720,
    videoLength: 10,
    previewFolder: 'public/preview',
    tasks: {}
  }


  core.makeVideoAPI = makeVideoAPI

  core.scene = makeScene()
  core.camera = makeCamera({ ...core })
  core.renderAPI = makeEngine({ ...core })
  core.boxAPI = makeBox({ ...core })
  core.computeTasks = ({ clock, delta }) => {
    for (var kn in core.tasks) {
      core.tasks[kn]({ clock, delta })
    }
  }

  core.web = makeWebServer({ ...core, core })

  // Tests.video = () => {
  //   // experiment
  //   let videoAPI = makeVideo({
  //     core,
  //     onLog: ({ at, total, progress }) => {
  //       // console.log(progress + '%')
  //     },
  //     onDone: ({ file }) => {

  //     }
  //   })
  //   videoAPI.start()
  //   // setTimeout(() => {
  //   //   videoAPI.abort()
  //   // }, 2000)
  // }
  return core
}

makeCinematicEngine()

// grep server_name /etc/nginx/sites-enabled/* -RiI