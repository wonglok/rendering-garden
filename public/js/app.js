import * as THREE from '../threejs/build/three.module.js'

import './shared.js'

let Shared = window.Shared

let makeEngine = ({ scene, camera }) => {
  var api = {}
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    width: 1080,
    height: 1080,
    canvas: document.querySelector('#canvas'),
    preserveDrawingBuffer: true
  });

  api.destory = () => {
  }

  api.render = () => {
    renderer.render(scene, camera);
  }

  return api
}

let donwloadTexture = ({ url }) => {
  return new Promise((resolve, reject) => {
    new THREE.TextureLoader().load(url, resolve)
  })
}

let makeTitleText = ({ width, height }) => {
  let canvas = document.createElement('canvas')
  Shared.drawText({ CanvasTextWrapper: window.CanvasTextWrapper, canvas, width, height })
  return new THREE.CanvasTexture(canvas)
}

let prepareTextures = async ({ core }) => {
  let Texture = {}
  Texture.leafBG = await donwloadTexture({ url: '/img/139-1920x1920.jpg' })
  await document.fonts.load('20pt "NotoSans"')
  Texture.text = await makeTitleText({ width: core.width, height: core.height })
  return Texture
}

let makeLogic = async () => {
  let web = Shared.webShim

  let core = await Shared.defineCore({ THREE, makeEngine })
  let Texture = await prepareTextures({ core })
  core = await Shared.makeCore({ core, web, Texture })

  let rAFID = 0
  var clockNow = 0;
  let loop = () => {
    rAFID = requestAnimationFrame(loop)
    core.renderAPI.render()
    // var abort = false
    // var i = -1;
    const SECONDS_OF_VIDEO = core.videoDuration || 1
    const FPS_FIXED = core.fps
    const DELTA = (1000 / FPS_FIXED);
    // const TOTAL_FRAMES = SECONDS_OF_VIDEO * FPS_FIXED;
    clockNow += DELTA
    for (var kn in core.tasks) {
      core.tasks[kn]({ delta: DELTA, clock: clockNow })
    }
  }
  loop()
}

setTimeout(() => {
  makeLogic()
}, 0)