module.exports = {
  apps: [
    {
      name: 'video-encoder.wonglok.com',
      script: 'npm',
      // watch: [
      //   './ecosystem.config.js',
      //   './boot.js',
      //   './_global',
      //   './app/**/*.js',
      //   './domains/**/*.js',
      //   './x/**/*.js'
      // ],
      // ignore_watch : ['node_modules', './global/public'],
      // Options reference: https://pm2.io/doc/en/runtime/reference/ecosystem-file/
      args: 'run dev-api',
      instances: 1,
      autorestart: true,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'development',
        PORT: 3123,
        NUXT_HOST: '0.0.0.0',
        NUXT_PORT: 3123
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3123,
        NUXT_HOST: '0.0.0.0',
        NUXT_PORT: 3123
      },
      error_file: './logs/err.log',
      out_file: './logs/out.log',
      log_file: './logs/combined.log',
      time: true,
      merge_logs: true
    },
    // {
    //   name: 'video-encoder-gui.wonglok.com',
    //   script: 'npm',
    //   // watch: [
    //   //   './ecosystem.config.js',
    //   //   './boot.js',
    //   //   './_global',
    //   //   './app/**/*.js',
    //   //   './domains/**/*.js',
    //   //   './x/**/*.js'
    //   // ],
    //   // ignore_watch : ['node_modules', './global/public'],
    //   // Options reference: https://pm2.io/doc/en/runtime/reference/ecosystem-file/
    //   args: 'run dev-gui',
    //   instances: 1,
    //   autorestart: true,
    //   max_memory_restart: '1G',
    //   env: {
    //     NODE_ENV: 'development',
    //     PORT: 8080,
    //     NUXT_HOST: '0.0.0.0',
    //     NUXT_PORT: 8080
    //   },
    //   env_production: {
    //     NODE_ENV: 'production',
    //     PORT: 8080,
    //     NUXT_HOST: '0.0.0.0',
    //     NUXT_PORT: 8080
    //   }
    //   // error_file: './logs/err.log',
    //   // out_file: './logs/out.log',
    //   // log_file: './logs/combined.log',
    //   // time: true,
    //   // merge_logs: true
    // },
  ]

  // deploy: {
  //   production: {
  //     key: '~/.ssh/mykey',
  //     user: 'anydata',
  //     host: '45.76.227.32',
  //     ref : 'origin/master',
  //     repo: 'git@github.com:bryantmcgill/api-anydata.git',
  //     path: '/home/anydata/api-anydata',
  //     'post-deploy': 'npm install && pm2 reload ecosystem.config.js --env production'
  //   }
  // }
}
