let THREE = require('three')
let CanvasTextWrapper = require('canvas-text-wrapper').CanvasTextWrapper
let Graphics = {}
/* eslint-disable-next-line */
var isFrontEnd = new Function("try {return window.document;}catch(e){return false;}");
/* eslint-disable-next-line */
let AdapterLoader = isFrontEnd() ? () => require('./adapter-front-end.js').default : () => eval(`require('./adapter-back-end.js')`).default
let Adapter = AdapterLoader()
let EventEmitter = require('events').EventEmitter
Graphics.isFrontEnd = isFrontEnd
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
        name: 'Noto Sans CJK TC'
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

  core.scene.background = new THREE.Color('#ffffff')
  // core.on('refresh', ({ bg }) => {
  //   if (bg) {
  //     core.scene.background = new THREE.Color(bg || '#ffffff')
  //   }
  // })

  core.spec = spec
  return core
}

Graphics.makeTitleText = async ({ fonts, width, height, spec, site }) => {
  let canvas = await Adapter.provideCanvas2D({
    width,
    height,
    fonts,
    site
  })
  Graphics.drawText({ CanvasTextWrapper: CanvasTextWrapper, canvas, width, height, spec })
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
  camera.position.set(0, 0, 150)
  scene.position.z = 0.0001

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
  let geo = new THREE.SphereBufferGeometry(150, 128, 128)
  let mat = new THREE.ShaderMaterial({
    transparent: true,
    uniforms: {
      time: { value: 0 },
      bg: { value: new THREE.Color('#ffffff') },
      tex: { value: core.textures.leafBG }
    },
    vertexShader: glsl`
      #include <common>
      varying vec2 vUv;
      varying vec3 vNormal;
      uniform float time;
      void main (void) {
        vUv = uv;
        vNormal = normal;
        vec3 nPos = position;
        nPos.y += sin(nPos.y * 0.1 + time * 30.0) * 5.0;

        gl_Position = projectionMatrix * modelViewMatrix * vec4(nPos, 1.0);
        gl_PointSize = 6.0;
      }
    `,
    fragmentShader: glsl`



      varying vec2 vUv;
      varying vec3 vNormal;

      uniform sampler2D tex;
      uniform float time;
      uniform vec3 bg;

      // Found this on GLSL sandbox. I really liked it, changed a few things and made it tileable.
      // :)
      // by David Hoskins.


      // Water turbulence effect by joltz0r 2013-07-04, improved 2013-07-07


      // Redefine below to see the tiling...
      //#define SHOW_TILING

      #define TAU 6.28318530718
      #define MAX_ITER 35

      vec4 waterwaves( in vec2 fragCoord, in vec2 iResolution, in float iTime)
      {
        float time = iTime * .5+23.0;
          // uv should be the 0-1 uv of texture...
        vec2 uv = fragCoord.xy / iResolution.xy;

      #ifdef SHOW_TILING
        vec2 p = mod(uv*TAU*2.0, TAU)-250.0;
      #else
          vec2 p = mod(uv*TAU, TAU)-250.0;
      #endif
        vec2 i = vec2(p);
        float c = 1.0;
        float inten = .005;

        for (int n = 0; n < MAX_ITER; n++)
        {
          float t = time * (1.0 - (3.5 / float(n+1)));
          i = p + vec2(cos(t - i.x) + sin(t + i.y), sin(t - i.y) + cos(t + i.x));
          c += 1.0/length(vec2(p.x / (sin(i.x+t)/inten),p.y / (cos(i.y+t)/inten)));
        }
        c /= float(MAX_ITER);
        c = 1.17-pow(c, 1.4);
        vec3 colour = vec3(pow(abs(c), 8.0));
        vec3 myColor = bg.rgb;
        colour = clamp(colour * myColor, 0.0, 1.0);

        #ifdef SHOW_TILING
        // Flash tile borders...
        vec2 pixel = 2.0 / iResolution.xy;
        uv *= 2.0;

        float f = floor(mod(iTime*.5, 2.0)); // Flash value.
        vec2 first = step(pixel, uv) * f; // Rule out first screen pixels and flash.
        uv  = step(fract(uv), pixel); // Add one line of pixels per tile.
        colour = mix(colour, vec3(1.0, 1.0, 0.0), (uv.x + uv.y) * first.x * first.y); // Yellow line

        #endif
        return vec4(colour, 1.0);
      }


      void main (void) {
        // vec4 color = texture2D(tex, mod(vUv + time, 1.0));

        vec4 water = waterwaves(gl_FragCoord.xy * (vNormal.xy + vNormal.zz), vec2(2048.0), time * 25.0);
        gl_FragColor = water;

        // gl_FragColor = vec4(color.rgb + 0.32, color.a);

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
  camera.lookAt(scene.position)

  mesh.rotation.x += Math.PI * 0.24
  scene.add(mesh)

  mat.uniforms.bg.value = new THREE.Color(core.spec.bg)
  core.on('refresh', async ({ bg }) => {
    mat.uniforms.bg.value = new THREE.Color(bg)
  })

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
  let makeTextImage = async ({ spec }) => {
    mat.map = await Graphics.makeTitleText({ ...core, spec, site: spec.site })
    mat.needsUpdate = true
  }
  await makeTextImage({ spec })

  core.on('refresh', async (spec) => {
    await makeTextImage({ spec })
  })

  // mat.uniforms.tex.value = await makeCanvasTexture()
  let mesh = new THREE.Mesh(geo, mat)
  scene.add(mesh)

  tasks[id] = ({ clock, delta }) => {
    // mat.uniforms.time.value = clock
  }
}

Graphics.drawText = ({ CanvasTextWrapper, canvas, width, height, spec }) => {
  canvas.width = width
  canvas.height = height
  var ctx = canvas.getContext('2d')
  let config = {
    font: '30px "Noto Sans CJK TC", sans-serif',
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
  let { text, fontColor } = spec
  ctx.lineWidth = 2
  ctx.fillStyle = fontColor || '#000000'
  ctx.strokeStyle = '#ff0000'
  let defaultText = `您好.
  How are u?
  I'm fine. thank you!`
  text = text || defaultText
  CanvasTextWrapper(canvas, text, config)
}

Graphics.sleep = (t) => new Promise(resolve => setTimeout(resolve, t))

module.exports = Graphics
