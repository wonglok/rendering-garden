let THREE = require('three')
let CanvasTextWrapper = require('canvas-text-wrapper').CanvasTextWrapper
let Graphics = {}
/* eslint-disable-next-line */
var isFrontEnd = new Function("try {return window.document;}catch(e){return false;}");
/* eslint-disable-next-line */
let AdapterLoader = isFrontEnd() ? () => require('./adapter-front-end.js').default : () => eval(`require('./adapter-back-end.js')`).default
let Adapter = AdapterLoader()
let EventEmitter = require('events').EventEmitter

Graphics.generateCore = async ({ web = Graphics.webShim, dom, spec = {} } = {}) => {
  let bus = new EventEmitter()
  let core = {
    _internal_spec: spec,
    get spec () {
      return core._internal_spec
    },
    set spec (v) {
      bus.emit('refresh', v)
      core._internal_spec = v
    },
    fps: 60,
    width: 1024,
    height: 1024,
    videoDuration: spec.videoDuration || 0.5,
    previewFolder: '/preview/',
    tasks: {},
    web: web || Graphics.webShim,
    dom: dom || false,
    fonts: [
      // {
      //   path: '/resource/fonts/emoji/NotoColorEmoji.ttf',
      //   name: 'NotoEmoji'
      // },
      {
        path: '/resource/fonts/NotoSansCJKtc-notscript/NotoSansCJKtc-Thin.otf',
        mime: 'font/otf',
        name: 'NotoSans'
      }
    ],
    textures: {
      leafBG: await Adapter.loadTexture({ file: '/resource/img/476-2048x2048.jpg', site: spec.site })
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
  await Adapter.loadFonts({ fonts: core.fonts, site: spec.site })

  core.scene = Graphics.makeScene()
  core.camera = Graphics.makeCamera({ ...core })
  core.renderAPI = Adapter.makeEngine({ ...core })

  core.boxAPI = await Graphics.makeArtPiece({ ...core, core })
  core.words = await Graphics.makeWords({ ...core, core })
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

  core.spec = spec
  return core
}

Graphics.makeTitleText = async ({ fonts, width, height, text, site }) => {
  let canvas = await Adapter.provideCanvas2D({
    width,
    height,
    fonts,
    site
  })
  Graphics.drawText({ CanvasTextWrapper: CanvasTextWrapper, canvas, width, height, text })
  return Adapter.makeCanvasIntoTexture({ canvas })
}

Graphics.makeScene = () => {
  var scene = new THREE.Scene()
  return scene
}

Graphics.makeCamera = ({ scene, width, height }) => {
  const VIEW_ANGLE = 75
  const ASPECT = width / height
  const NEAR = 0.1
  const FAR = 10000000000000
  var camera = new THREE.PerspectiveCamera(VIEW_ANGLE, ASPECT, NEAR, FAR)
  camera.position.set(0, 0, 50)
  camera.lookAt(scene.position)
  return camera
}

Graphics.getID = () => {
  return `_${(Math.random() * 10000000).toFixed(0)}`
}

Graphics.makeArtPiece = async ({ core, tasks, scene, camera, web }) => {
  const id = Graphics.getID()
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

        gl_FragColor = vec4(color.rgb + 0.32, color.a);

        // // color.r *= abs(sin(time));
        // if (length(gl_PointCoord.xy - 0.5) < 0.5) {
        //   vec3 cc = vec3(color.rgb + 0.35);
        //   // cc *= cc;

        //   gl_FragColor = vec4(cc.bgr + 0.5, color.a);
        // } else {
        //   discard;
        // }
      }
    `,
    // color: 0xff00ff,
    // wireframe: true,
    side: THREE.DoubleSide
  })

  let mesh = new THREE.Mesh(geo, mat)
  mesh.position.z = -camera.position.z * 1.5

  mesh.rotation.x += Math.PI * 0.24
  scene.add(mesh)

  tasks[id] = ({ clock, delta }) => {
    mat.uniforms.time.value = clock * 0.0001
  }

  return {
    mesh
  }
}

Graphics.visibleHeightAtZDepth = (depth, camera) => {
  // compensate for cameras not positioned at z=0
  const cameraOffset = camera.position.z
  if (depth < cameraOffset) depth -= cameraOffset
  else depth += cameraOffset

  // vertical fov in radians
  const vFOV = camera.fov * Math.PI / 180

  // Math.abs to ensure the result is always positive
  return 2 * Math.tan(vFOV / 2) * Math.abs(depth)
}

Graphics.visibleWidthAtZDepth = (depth, camera) => {
  const height = Graphics.visibleHeightAtZDepth(depth, camera)
  return height * camera.aspect
}

Graphics.webShim = {
  pushVideo: () => {},
  pushImage: () => {},
  notify: () => {},
  done: () => {},
  progress: () => {},
  streamImage: () => {}
}

Graphics.makeWords = async ({ core, spec, width, height, scene, camera, tasks, web }) => {
  let id = Graphics.getID()

  web.notify('drawing text....')
  let widthGeo = Graphics.visibleWidthAtZDepth(0, camera)
  let geo = new THREE.PlaneBufferGeometry(widthGeo, widthGeo, 4, 4)
  let mat = new THREE.MeshBasicMaterial({
    map: null,
    transparent: true
  })
  let makeTextImage = async ({ text }) => {
    mat.map = await Graphics.makeTitleText({ ...core, text, site: spec.site })
    mat.needsUpdate = true
  }
  await makeTextImage({ text: spec.text })

  core.on('refresh', async ({ text }) => {
    await makeTextImage({ text: text })
  })

  // mat.uniforms.tex.value = await makeCanvasTexture()
  let mesh = new THREE.Mesh(geo, mat)
  scene.add(mesh)

  tasks[id] = ({ clock, delta }) => {
    // mat.uniforms.time.value = clock
  }
}

Graphics.drawText = ({ CanvasTextWrapper, canvas, width, height, text }) => {
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

Graphics.sleep = (t) => new Promise(resolve => setTimeout(resolve, t))

module.exports = Graphics
