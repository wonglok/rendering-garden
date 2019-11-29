var THREE = require('three')
let Adapter = {
  makeEngine: ({ width, height, scene, camera }) => {
    var api = {}
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      width: width,
      height: height,
      canvas: document.querySelector('#canvas'),
      preserveDrawingBuffer: true
    });

    api.destory = () => {
    }

    api.render = () => {
      renderer.render(scene, camera);
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
    for (var kn in fonts) {
      let f = fonts[kn]
      await document.fonts.load(`20pt "${f.name}"`)
    }
    return canvas
  },
  makeCanvasIntoTexture: ({ canvas }) => {
    return new THREE.CanvasTexture(canvas)
  }
}

module.exports.default = Adapter
