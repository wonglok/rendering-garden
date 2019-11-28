let def = {}

let makeScene = def.makeScene = ({ THREE }) => {
  var scene = new THREE.Scene();
  return scene
}

let makeCamera = def.makeCamera = ({ THREE, scene, width, height }) => {
  const VIEW_ANGLE = 75
  const ASPECT = width / height
  const NEAR = 0.1
  const FAR = 10000000000000
  var camera = new THREE.PerspectiveCamera(VIEW_ANGLE, ASPECT, NEAR, FAR)
  camera.position.set(0, 0, 50)
  camera.lookAt(scene.position)
  return camera
}

let getID = def.getID = () => {
  return `_${(Math.random() * 10000000).toFixed(0)}`
}

let make3DItem = def.make3DItem = async ({ THREE, texture, tasks, scene, camera, web }) => {
  const id = getID()
  web.notify('loading texture....')
  let glsl = v => v[0]
  let geo = new THREE.SphereBufferGeometry(50, 128, 128)
  let mat = new THREE.ShaderMaterial({
    transparent: true,
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
        gl_PointSize = 8.0;
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
        //   gl_FragColor = vec4(color.rgb + 0.32,color.a);
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

let visibleHeightAtZDepth = def.visibleHeightAtZDepth = (depth, camera) => {
  // compensate for cameras not positioned at z=0
  const cameraOffset = camera.position.z
  if (depth < cameraOffset) depth -= cameraOffset
  else depth += cameraOffset

  // vertical fov in radians
  const vFOV = camera.fov * Math.PI / 180

  // Math.abs to ensure the result is always positive
  return 2 * Math.tan(vFOV / 2) * Math.abs(depth)
}

let visibleWidthAtZDepth = def.visibleWidthAtZDepth = (depth, camera) => {
  const height = visibleHeightAtZDepth(depth, camera)
  return height * camera.aspect
}

let webShim = def.webShim = {
  pushImage: () => {},
  notify: () => {}
}

let get3DWords = def.get3DWords = async ({ THREE, width, height, scene, camera, tasks, web, texture }) => {
  let id = getID()

  web.notify('drawing text....')
  let widthGeo = visibleWidthAtZDepth(0, camera)
  let geo = new THREE.PlaneBufferGeometry(widthGeo, widthGeo, 4, 4)
  let mat = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true
  })
  // mat.uniforms.tex.value = await makeCanvasTexture()
  let mesh
  mesh = new THREE.Mesh(geo, mat)
  scene.add(mesh)

  tasks[id] = ({ clock, delta }) => {
    // mat.uniforms.time.value = clock
  }
  scene.background = new THREE.Color('#ffffff')
}

def.drawText = ({ CanvasTextWrapper, canvas, width, height }) => {
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
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#ff0000';

  let text = `您好 How are u? I'm fine thank you!`
  CanvasTextWrapper(canvas, text, config);
}

def.makeTextMaterial = () => {
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


def.sleep = (t) => new Promise(resolve => setTimeout(resolve, t))

def.defineCore = async ({ THREE, makeEngine }) => {
  let core = {
    makeEngine,
    THREE,
    fps: 30,
    width: 1080,
    height: 1080,
    videoDuration: 5,
    previewFolder: 'public/preview',
    tasks: {}
  }

  return core
}

def.makeCore = async ({ core, web, Texture }) => {
  let { makeEngine } = core
  core.scene = makeScene({ ...core })
  core.camera = makeCamera({ ...core })
  core.renderAPI = makeEngine({ ...core })

  core.boxAPI = await make3DItem({ ...core, web, texture: Texture.leafBG })
  core.words = await get3DWords({ ...core, web, texture: Texture.text })
  core.computeTasks = ({ clock, delta }) => {
    for (var kn in core.tasks) {
      core.tasks[kn]({ clock, delta })
    }
  }
  return core
}

if (globalThis.process) {
  module.exports = def
} else {
  window.Shared = def
}