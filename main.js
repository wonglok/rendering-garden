// const THREE = require('three')
const path = require('path')
const Shared = require('./src/js/shared.js')
// var CanvasTextWrapper = require('canvas-text-wrapper').CanvasTextWrapper;
// var Adapter = require('./src/js/adapter-back-end.js').default;

let makeWebServer = () => {
  const webpack = require('webpack')
  const middleware = require('webpack-dev-middleware')
  const VueLoaderPlugin = require('vue-loader/lib/plugin')

  const compiler = webpack({
    mode: 'development',
    // webpack options
    entry: './src/js/main-front-end.js',
    output: {
      filename: './dist/bundle.js',
      path: path.resolve(__dirname, 'dist'),
    },
    module: {
      rules: [
        {
          test: /\.vue$/,
          loader: 'vue-loader'
        },
        // this will apply to both plain `.js` files
        // AND `<script>` blocks in `.vue` files
        {
          test: /\.js$/,
          loader: 'babel-loader'
        },
        // this will apply to both plain `.css` files
        // AND `<style>` blocks in `.vue` files
        {
          test: /\.css$/,
          use: [
            'vue-style-loader',
            'css-loader'
          ]
        }
      ]
    },
    plugins: [
      // make sure to include the plugin for the magic
      new VueLoaderPlugin()
    ]
  });

  let express = require('express');
  var app = express();
  var http = require('http').Server(app);
  var io = require('socket.io')(http);
  var port = process.env.PORT || 3123;

  app.use(
    middleware(compiler, {
      // webpack-dev-middleware options
    })
  );

  app.get('/', function(req, res){
    res.sendFile(__dirname + '/public/index.html');
  });

  app.use('/public', express.static('public'))
  app.get('/img', (req, res) => {
    createScreenShot({
      web: {
        notify: (msg) => {
          io.emit('chat message', `${msg}`);
        },
        pushImage: (data) => {
          data.stream.pipe(res)
        }
      }
    })
  })

  io.on('connection', function(socket){
    socket.on('chat message', function(msg){
      io.emit('chat message', msg);
    });

    socket.on('chat message', async (msg) => {
      if (msg === 'video') {
        // console.log('made a engine')
        let videoAPI = await makeVideoAPI({
          web: {
            notify: (msg) => {
              io.emit('chat message', `${msg}`);
            },
            pushImage: () => {}
          }
        })
        videoAPI.start()
      }
      if (msg === 'pic') {
        io.emit('chat message', `<img src="/img" style="max-width: 100%" onload="window.scrollBottom" alt="image">`)
      }
    })
    // socket.once('disconnect', () => {
    //   console.log('disconnect')
    // })
  });

  http.listen(port, function(){
    console.log('listening on *:' + port);
  });

  return {
    io
  }
}

let createScreenShot = async ({ web = Shared.webShim }) => {
  let core = await Shared.generateCore({ web })

  core.scene.scale.y = -1
  core.scene.rotation.z = Math.PI * 0.5

  var clockNow = 0;
  // const SECONDS_OF_VIDEO = core.videoDuration || 1
  const FPS_FIXED = core.fps
  const DELTA = (1000 / FPS_FIXED);
  core.computeTasks({ clock: clockNow, delta: DELTA })
  const { pixels } = core.renderAPI.render()
  // const combined = Buffer.from(pixels)
  let ndarray = require('ndarray')
  let savePixels = require('save-pixels')
  let stream = savePixels(ndarray(pixels, [core.width, core.height, 4]), 'png', { quality: 60 });

  web.pushImage({
    width: core.width,
    height: core.width,
    stream
  });
  core.renderAPI.destory()
}

let makeVideoAPI = async ({ web = Shared.webShim }) => {
  let core = await Shared.generateCore({ web })

  const path = require('path');
  const os = require('os');
  const fs = require('fs');
  const Encoder = require('./vid.encoder.js')

  const temp = os.tmpdir()
  const filename = './tempvid.mp4'
  const onDone = ({ output }) => {
    web.notify('Video is online....')
    let newFilename = `_${(Math.random() * 10000000).toFixed(0)}.mp4`
    let newfile = path.join(__dirname, core.previewFolder, newFilename)

    web.notify(`<a class="link-box" target="_blank" href="${core.previewFolder}${newFilename}">/preview/${newFilename}</a>`)
    web.notify(`<video autoplay loop controls class="video-box" src="${core.previewFolder}${newFilename}">${newFilename}</video>`)
    fs.rename(output, newfile, (err) => {
      if (err) throw err;
      console.log('file is at:', newfile);
      // fs.unlinkSync(output)
      console.log(`https://video-encoder.wonglok.com${core.previewFolder}${newFilename}`)
      console.log('cleanup complete!');
      // encoder.kill()
    });
  }
  const encoder = new Encoder({
    output: path.join(temp, filename),
    width: core.width,
    height: core.height,
    fps: core.fps,
    onDone
  });
  // encoder.promise.then(onDone);
  // encoder.on('console', (evt) => {
  //   // console.log(evt)
  // });
  // encoder.on('done', (evt) => {
  //   web.notify('Finished encoding video....')
  // });

  var abort = false
  var i = -1;
  var clockNow = 0;
  const SECONDS_OF_VIDEO = core.videoDuration || 1
  const FPS_FIXED = core.fps
  const DELTA = (1000 / FPS_FIXED);
  const TOTAL_FRAMES = SECONDS_OF_VIDEO * FPS_FIXED;

  const repeat = () => {
    i++;
    const now = (i - 1) < 0 ? 0 : (i - 1)
    const progress = {
      at: now.toFixed(0),
      total: TOTAL_FRAMES.toFixed(0),
      progress: (now / TOTAL_FRAMES).toFixed(4)
    }

    console.log('progress', progress)
    web.notify(`Progress: ${((now / TOTAL_FRAMES) * 100).toFixed(2).padStart(6, '0')}%, ${now.toFixed(0).padStart(6, '0')} / ${TOTAL_FRAMES.toFixed(0).padStart(6, '0')} Frames Processed`);

    clockNow += DELTA
    core.computeTasks({ clock: clockNow, delta: DELTA })
    const { pixels } = core.renderAPI.render()
    const combined = Buffer.from(pixels);
    encoder.passThrough.write(combined, () => {
      if (i > TOTAL_FRAMES || abort) {
        web.notify('Begin packing video');
        encoder.passThrough.end();
        process.nextTick(() => {
          core.renderAPI.destory();
        });
      } else {
        setTimeout(repeat, 0);
      }
    })
  }

  return {
    start () {
      repeat()
    },
    abort () {
      abort = true
    }
  }
}

makeWebServer()
