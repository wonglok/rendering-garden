var spawn = require('child_process').spawn;
var Stream = require('stream');
const EventEmitter = require('events');

module.exports = class Encoder extends EventEmitter {

  constructor({ music = false, output = 'out.mp4', fps = '30', width = '720', height = '720', onDone = () => {} }){
    super();

    this.passThrough = new Stream.PassThrough();

    this.promise = new Promise((resolve, reject) => {
      var args = [];

      args = args.concat([
          '-y',
          // '-f', 'image2pipe',
          // raw 1080 pixel
          '-f', 'rawvideo', '-vcodec', 'rawvideo', '-s', `${width}x${height}`, '-pix_fmt', 'rgba', '-r', fps,
          '-i', 'pipe:0',
        ]);

        if (music){
          args = args.concat([
            '-i', music,
          ]);
        }

        args = args.concat([
          '-hide_banner',

          '-shortest',

          //'-q:v', '1',
          '-c:v', 'libx264',
          '-c:a', 'aac',
          '-pix_fmt', 'yuv420p',
          // '-crf', '18',
          '-crf', '18',
          '-tune', 'fastdecode',
          '-preset', 'ultrafast',
          '-movflags', 'frag_keyframe+empty_moov+faststart',
          '-framerate', `${fps}`,

          '-f', 'mp4',

          output,
          // 'pipe:1'

        ]);

        this.ffmpegProcess  = spawn('ffmpeg', args);

        // this.ffmpegProcess.stderr.on('data', (data) => {
        //   var buff = new Buffer(data);
        //   let str = buff.toString('utf8');
        //   // console.log(str);
        //   this.emit('console', str);
        // });

        // this.ffmpegProcess.stderr.on('end', function(data){
        //   // var buff = new Buffer(data);
        //   // console.log(buff.toString('utf8'));
        // });

        this.ffmpegProcess.stderr.pipe(process.stdout);

        this.passThrough.pipe(this.ffmpegProcess.stdin);

        // var buffers = [];
        // this.ffmpegProcess.stdout.on('data', (dataBuffers) => {
        //   buffers.push(dataBuffers);
        // });
        this.ffmpegProcess.stdout.on('end', () => {
          onDone({ output })
          resolve({ output });
          this.emit('done', { output })
          this.ffmpegProcess.kill();
        });
    });
  }

  //var base64 = self.canvas2D.getBase64();
  //addBuffer({ buffer: new Buffer(base64, 'base64'), shouldClose: shouldClose, next: processNextTick });
  addBuffer({ buffer, shouldClose, next }) {
    this.passThrough.write(buffer, () => {

      if (shouldClose){
        this.passThrough.end();
      }else{
        if (next){
          next();
        }
      }

    });
  }

  kill(){
    this.ffmpegProcess.kill();
  }

}