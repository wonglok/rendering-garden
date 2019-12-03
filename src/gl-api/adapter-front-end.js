var THREE = require('three')
var FontCache = new Map()
var localforage = require('localforage')
THREE.Cache.enabled = true

var BlobCache = {
  async download (url) {
    let output = await fetch(url)
      .then((response) => {
        return response.blob()
      })
      .then((data) => {
        localforage.setItem(url, data)
        return data
      })
    return output
  },
  async provideBlobURL (url) {
    return localforage.getItem(url)
      .then(async (data) => {
        return data || Promise.reject(data)
      })
      .catch(() => {
        return BlobCache.download(url)
      })
      .then((data) => {
        return URL.createObjectURL(data)
      })
  }
}

let Adapter = {
  loadFonts: async ({ site, fonts }) => {
    for (var kn in fonts) {
      let f = fonts[kn]
      if (FontCache.has(f.path)) {
        continue
      }
      let blobURL = await BlobCache.provideBlobURL(site + f.path)
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
      canvas: dom || document.querySelector('#canvas'),
      preserveDrawingBuffer: true
    })

    renderer.setSize(width, height)
    renderer.domElement.style.width = '100%'
    renderer.domElement.style.height = '100%'
    renderer.domElement.style.objectFit = 'contain'
    renderer.domElement.style.objectPosition = 'center'

    api.destory = () => {
    }

    api.render = () => {
      renderer.render(scene, camera)
    }

    return api
  },
  loadTexture: ({ site, file }) => {
    return new Promise(async (resolve, reject) => {
      let blobURL = await BlobCache.provideBlobURL(site + file)
      new THREE.TextureLoader().load(blobURL, (texture) => {
        texture.flipY = true
        resolve(texture)
      })
    })
  },
  provideCanvas2D: async ({ width, height, fonts, site }) => {
    let canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    await Adapter.loadFonts({ fonts, site })
    return canvas
  },
  makeCanvasIntoTexture: ({ canvas }) => {
    let texture = new THREE.CanvasTexture(canvas)
    texture.flipY = true
    return texture
  }
}

module.exports.default = Adapter
