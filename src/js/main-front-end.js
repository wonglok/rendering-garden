// import * as THREE from 'three'
import * as Shared from './shared.js'
// import { CanvasTextWrapper } from 'canvas-text-wrapper'

let makeRenderEngine = async () => {
  let core = await Shared.generateCore()
  // let Texture = await Shared.prepareTextures({ core, Adapter })
  // core = await Shared.makeCore({ core, web, Texture, Adapter })

  let rAFID = 0
  var clockNow = 0;
  let loop = () => {
    rAFID = requestAnimationFrame(loop)
    core.renderAPI.render()
    // var abort = false
    // var i = -1;
    // const SECONDS_OF_VIDEO = core.videoDuration || 1
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
  makeRenderEngine()
}, 0)