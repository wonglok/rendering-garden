
apt-get install

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



1. ffmepg
2. nginx
3. headless gl

# headless gl

sudo apt-get install -y build-essential libxi-dev libglu1-mesa-dev libglew-dev pkg-config

# opengl simulator

sudo apt-get install xvfb

# node canvas

sudo apt-get install build-essential libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev