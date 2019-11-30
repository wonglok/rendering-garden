import * as Shared from './shared.js'

export const install = async ({ canvas, data }) => {
  let api = {}
  let core = await Shared.generateCore({ dom: canvas, data })
  api.core = core

  let rAFID = 0
  let clockNow = 0
  let loop = () => {
    rAFID = requestAnimationFrame(loop)
    core.renderAPI.render()
    // var abort = false
    // var i = -1;
    // const SECONDS_OF_VIDEO = core.videoDuration || 1
    const FPS_FIXED = core.fps
    const DELTA = (1000 / FPS_FIXED)
    // const TOTAL_FRAMES = SECONDS_OF_VIDEO * FPS_FIXED;
    clockNow += DELTA
    for (var kn in core.tasks) {
      core.tasks[kn]({ delta: DELTA, clock: clockNow })
    }
  }

  api.start = () => {
    rAFID = requestAnimationFrame(loop)
  }

  api.stop = () => {
    core.clean()
    cancelAnimationFrame(rAFID)
  }

  return api
}

window.UniversalWebGL = {
  install
}
