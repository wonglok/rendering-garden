let THREE = require('three')
let CanvasTextWrapper = require('canvas-text-wrapper').CanvasTextWrapper
let Shared = {}
/* eslint-disable-next-line */
var isFrontEnd = new Function("try {return window.document;}catch(e){return false;}");
/* eslint-disable-next-line */
let AdapterLoader = isFrontEnd() ? () => require('./adapter-front-end.js').default : () => eval('require')('./adapter-back-end.js').default
let Adapter = AdapterLoader()
let EventEmitter = require('events').EventEmitter

Shared.generateCore = async ({ web = Shared.webShim, dom, data = {} } = {}) => {
  let bus = new EventEmitter()
  let core = {
    _data: data,
    get data () {
      return core._data
    },
    set data (v) {
      bus.emit('refresh', v)
      core._data = v
    },
    fps: 60,
    width: 1024,
    height: 1024,
    videoDuration: data.videoDuration || 0.5,
    previewFolder: '/preview/',
    tasks: {},
    web: web || Shared.webShim,
    dom: dom || false,
    fonts: [
      // {
      //   path: '/resource/fonts/emoji/NotoColorEmoji.ttf',
      //   name: 'NotoEmoji'
      // },
      {
        path: '/resource/fonts/NotoSansCJKtc-notscript/NotoSansCJKtc-Thin.otf',
        name: 'NotoSans'
      }
    ],
    textures: {
      leafBG: await Adapter.loadTexture({ file: '/resource/img/139-1920x1920.jpg' })
    },
    on: (e, h) => {
      bus.on(e, h)
    },
    once: (e, h) => {
      bus.once(e, h)
    },
    emit: (e, v) => {
      bus.emit(e, v)
    },
    clean: () => {
      bus.removeAllListeners()
    }
  }
  await Adapter.loadFonts({ fonts: core.fonts })

  core.scene = Shared.makeScene()
  core.camera = Shared.makeCamera({ ...core })
  core.renderAPI = Adapter.makeEngine({ ...core })

  core.boxAPI = await Shared.makeArtPiece({ ...core, core })
  core.words = await Shared.makeWords({ ...core, core })
  core.computeTasks = ({ clock, delta }) => {
    for (var kn in core.tasks) {
      core.tasks[kn]({ clock, delta })
    }
  }

  core.on('refresh', ({ bg }) => {
    if (bg) {
      core.scene.background = new THREE.Color(bg || '#ffffff')
    }
  })

  core.data = data
  return core
}

Shared.makeTitleText = async ({ fonts, width, height, text }) => {
  let canvas = await Adapter.provideCanvas2D({
    width,
    height,
    fonts
  })
  Shared.drawText({ CanvasTextWrapper: CanvasTextWrapper, canvas, width, height, text })
  return Adapter.makeCanvasIntoTexture({ canvas })
}

Shared.makeScene = () => {
  var scene = new THREE.Scene()
  return scene
}

Shared.makeCamera = ({ scene, width, height }) => {
  const VIEW_ANGLE = 75
  const ASPECT = width / height
  const NEAR = 0.1
  const FAR = 10000000000000
  var camera = new THREE.PerspectiveCamera(VIEW_ANGLE, ASPECT, NEAR, FAR)
  camera.position.set(0, 0, 50)
  camera.lookAt(scene.position)
  return camera
}

Shared.getID = () => {
  return `_${(Math.random() * 10000000).toFixed(0)}`
}

Shared.makeArtPiece = async ({ core, tasks, scene, camera, web }) => {
  const id = Shared.getID()
  web.notify('loading texture....')
  let glsl = v => v[0]
  let geo = new THREE.SphereBufferGeometry(50, 128, 128)
  let mat = new THREE.ShaderMaterial({
    transparent: true,
    uniforms: {
      time: { value: 0 },
      tex: { value: core.textures.leafBG }
    },
    vertexShader: glsl`
      #include <common>
      varying vec2 vUv;
      uniform float time;
      void main (void) {
        vUv = uv;
        vec3 nPos = position;
        nPos.y += sin(nPos.y * 0.1 + time * 30.0) * 5.0;

        gl_Position = projectionMatrix * modelViewMatrix * vec4(nPos, 1.0);
        gl_PointSize = 6.0;
      }
    `,
    fragmentShader: glsl`
      varying vec2 vUv;
      uniform sampler2D tex;
      uniform float time;
      void main (void) {
        vec4 color = texture2D(tex, mod(vUv + sin(time), 1.0));

        // gl_FragColor = vec4(color.rgb + 0.32, color.a);

        // color.r *= abs(sin(time));
        if (length(gl_PointCoord.xy - 0.5) < 0.5) {
          vec3 cc = vec3(color.rgb + 0.35);
          cc *= cc;

          gl_FragColor = vec4(cc.bgr + 0.5, color.a);
        } else {
          discard;
        }
      }
    `,
    // color: 0xff00ff,
    // wireframe: true,
    side: THREE.DoubleSide
  })

  let mesh = new THREE.Points(geo, mat)
  // mesh.position.z = -camera.position.z
  // mesh.scale = 2
  // mesh.scale = 2
  // mesh.scale = 2
  mesh.rotation.x += Math.PI * 0.5
  scene.add(mesh)

  tasks[id] = ({ clock, delta }) => {
    mat.uniforms.time.value = clock * 0.0001
  }

  return {
    mesh
  }
}

Shared.visibleHeightAtZDepth = (depth, camera) => {
  // compensate for cameras not positioned at z=0
  const cameraOffset = camera.position.z
  if (depth < cameraOffset) depth -= cameraOffset
  else depth += cameraOffset

  // vertical fov in radians
  const vFOV = camera.fov * Math.PI / 180

  // Math.abs to ensure the result is always positive
  return 2 * Math.tan(vFOV / 2) * Math.abs(depth)
}

Shared.visibleWidthAtZDepth = (depth, camera) => {
  const height = Shared.visibleHeightAtZDepth(depth, camera)
  return height * camera.aspect
}

Shared.webShim = {
  pushVideo: () => {},
  pushImage: () => {},
  notify: () => {}
}

Shared.makeWords = async ({ core, data, width, height, scene, camera, tasks, web }) => {
  let id = Shared.getID()

  web.notify('drawing text....')
  let widthGeo = Shared.visibleWidthAtZDepth(0, camera)
  let geo = new THREE.PlaneBufferGeometry(widthGeo, widthGeo, 4, 4)
  let mat = new THREE.MeshBasicMaterial({
    map: null,
    transparent: true
  })
  let uploadTex = async ({ text }) => {
    mat.map = await Shared.makeTitleText({ ...core, text })
    mat.needsUpdate = true
  }
  await uploadTex({ text: data.text })

  core.on('refresh', async ({ text }) => {
    uploadTex({ text: text })
  })

  // mat.uniforms.tex.value = await makeCanvasTexture()
  let mesh = new THREE.Mesh(geo, mat)
  scene.add(mesh)

  tasks[id] = ({ clock, delta }) => {
    // mat.uniforms.time.value = clock
  }
}

Shared.drawText = ({ CanvasTextWrapper, canvas, width, height, text }) => {
  canvas.width = width
  canvas.height = height
  var ctx = canvas.getContext('2d')
  let config = {
    font: '30px NotoSans, sans-serif',
    lineHeight: 1,
    textAlign: 'center',
    verticalAlign: 'middle', // top, middle, bottom
    paddingX: 40,
    paddingY: 40,
    fitParent: false,
    lineBreak: 'auto',
    strokeText: false,
    sizeToFill: true,
    maxFontSizeToFill: 60,
    allowNewLine: true,
    justifyLines: false,
    renderHDPI: true,
    textDecoration: 'none'
  }
  ctx.lineWidth = 2
  ctx.strokeStyle = '#ff0000'
  let defaultText = `您好.
  How are u?
  I'm fine. thank you!`
  text = text || defaultText
  CanvasTextWrapper(canvas, text, config)
}

Shared.sleep = (t) => new Promise(resolve => setTimeout(resolve, t))

module.exports = Shared
