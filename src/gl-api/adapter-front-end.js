var THREE = require('three')
var FontCache = new Map()
var localforage = require('localforage')
THREE.Cache.enabled = true

var BlobCache = {
  async download (url) {
    let output = await fetch(url)
      .then(async (response) => {
        return await response.blob()
      })
      .then((data) => {
        localforage.setItem(url, data)
        return data
      })
    return output
  },
  async provideBlobURL (url, mime) {
    return localforage.getItem(url)
      .then(async (data) => {
        return !!data ? data : Promise.reject()
      })
      .catch(async () => {
        return await BlobCache.download(url)
      })
      .then((data) => {
        return URL.createObjectURL(data, { type: mime || 'font/otf' })
      })
  }
}

let Adapter = {
  loadFonts: async ({ fonts }) => {
    for (var kn in fonts) {
      let f = fonts[kn]
      if (FontCache.has(f.path)) {
        continue
      }
      let blobURL = await BlobCache.provideBlobURL(f.path, f.mime)
      var oneFont = new FontFace(f.name, `url(${blobURL})`)
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
    return new Promise(async (resolve, reject) => {
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
