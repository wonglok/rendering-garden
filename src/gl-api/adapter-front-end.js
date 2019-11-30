var THREE = require('three')
var FontCache = new Map()
let Adapter = {
  loadFonts: async ({ fonts }) => {
    for (var kn in fonts) {
      let f = fonts[kn]
      if (FontCache.has(f.path)) {
        continue
      }
      var oneFont = new FontFace(f.name, `url(${f.path})`)
      document.fonts.add(oneFont)
      await document.fonts.load(`20pt "${f.name}"`)
      FontCache.set(f.path, oneFont)
    }
  },
  makeEngine: ({ width, height, scene, camera, dom }) => {
    var api = {}
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      width: width,
      height: height,
      canvas: dom || document.querySelector('#canvas'),
      preserveDrawingBuffer: true
    })

    renderer.setSize(width, height)

    api.destory = () => {
    }

    api.render = () => {
      renderer.render(scene, camera)
    }

    return api
  },
  loadTexture: ({ file }) => {
    return new Promise((resolve, reject) => {
      new THREE.TextureLoader().load(file, resolve)
    })
  },
  provideCanvas2D: async ({ width, height, fonts }) => {
    let canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    await Adapter.loadFonts({ fonts })
    return canvas
  },
  makeCanvasIntoTexture: ({ canvas }) => {
    return new THREE.CanvasTexture(canvas)
  }
}

module.exports.default = Adapter
