const THREE = require('three')
const LRU = require('lru-cache')
const options = {
  max: 500,
  maxAge: 1000 * 60 * 60
}
const TextureCache = new LRU(options)
const path = require('path')
const Adapter = {
  provideCanvas2D: async ({ fonts, width, height }) => {
    /* eslint-disable */
    var Canvas = eval('require')('canvas')
    fonts.forEach((f) => {
      //
      // NotoSans
      Canvas.registerFont('.' + f.path, { family: f.name })
    })
    /* eslint-enable */
    var canvas = Canvas.createCanvas(width, height)
    return canvas
  },
  makeCanvasIntoTexture: ({ canvas }) => {
    var THREE = require('three')
    var buf = canvas.toBuffer('raw')
    var ab = new ArrayBuffer(buf.length)
    var view = new Uint8Array(ab)
    for (var i = 0; i < buf.length; ++i) {
      view[i] = buf[i]
    }
    return new THREE.DataTexture(ab, canvas.width, canvas.height, THREE.RGBAFormat)
  },
  loadTexture: ({ file }) => {
    file = path.join(__dirname, '../../', file)
    return new Promise((resolve, reject) => {
      if (TextureCache.has(file)) {
        resolve(TextureCache.get(file))
        return
      }
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

        let texture = new THREE.DataTexture(pixels.data, info[0], info[1], THREE.RGBAFormat)
        texture.needsUpdate = true
        // let output = {
        //   width: info[0],
        //   height: info[1],
        //   texture
        // }
        TextureCache.set(file, texture)
        resolve(texture)
      })
    })
  },
  makeEngine: ({ camera, scene, width, height }) => {
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
    }

    const canvas = {
      getContext () {
        return gl
      },
      addEventListener () {
      }
    }

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      width: 0,
      height: 0,
      canvas: canvas,
      context: gl
    })

    const rtTexture = new THREE.WebGLRenderTarget(width, height, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.NearestFilter,
      format: THREE.RGBAFormat
    })

    api.destory = () => {
      const ext = gl.getExtension('STACKGL_destroy_context')
      ext.destroy()
    }

    api.render = () => {
      renderer.setRenderTarget(rtTexture)
      renderer.render(scene, camera)

      const gl = renderer.getContext()
      const pixels = new Uint8Array(4 * width * height)
      gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels)

      return {
        pixels
      }
    }

    return api
  }
}

module.exports.default = Adapter
