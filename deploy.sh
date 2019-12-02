ssh -t lok@video-encoder.wonglok.com 'bash -i -c "cd video.wonglok.com; cd rendering-garden; git pull; npm i; npm run pm2restart;"'
ssh -t lok@ec2-renderer.wonglok.com 'bash -i -c "cd rendering-garden; git pull; npm i; npm run pm2restart;"'
# ssh -t lok@ec2-renderer.wonglok.com 'bash -i -c "cd rendering-garden; ls"'
