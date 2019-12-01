import * as Graphics from './shared.js'
import io from 'socket.io-client'
export const install = async ({ canvas, data, src }) => {
  let api = {}
  let core = await Graphics.generateCore({ dom: canvas, data })
  api.core = core
  let socket = io(src)

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

  api.socket = socket

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
