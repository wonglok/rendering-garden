# add user

adduser lok
usermod -aG sudo lok

## mac
cat ~/.ssh/id_rsa.pub

# switch to lok
su - lok

mkdir ~/.ssh
chmod 700 ~/.ssh
touch ~/.ssh/authorized_keys
nano ~/.ssh/authorized_keys

chmod 600 ~/.ssh/authorized_keys
exit

# client size
sudo nano /etc/nginx/nginx.conf
# under http or server
client_max_body_size 1024M;

# install nginx

# nginx

server {
    server_name SUBDOMAIN.wonglok.com;
    location / {
      proxy_http_version 1.1;
      proxy_set_header Upgrade $http_upgrade;
      proxy_set_header Connection "upgrade";
      proxy_set_header X-Real-IP $remote_addr;
      proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
      proxy_set_header X-NginX-Proxy true;
      proxy_set_header Host $http_host;
      proxy_cache_bypass $http_upgrade;
      proxy_redirect off;
      proxy_pass http://0.0.0.0:3123;
    }
}


apt-get install

1. ffmepg
3. python

# headless gl
sudo apt-get install -y build-essential libxi-dev libglu1-mesa-dev libglew-dev pkg-config xvfb

# xvfb opengl simulator
sudo apt-get install xvfb

# node canvas
sudo apt-get install build-essential libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev

# npm install
npm i;
