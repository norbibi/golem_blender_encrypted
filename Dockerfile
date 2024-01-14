FROM pwalski/golem_nvidia_base:latest

RUN apt-get update && DEBIAN_FRONTEND=noninteractive apt-get install -y \
	libglvnd-dev \
	libx11-6 \
	libxi6 \
	libxxf86vm1 \
	libxrender1 \
	libxfixes3 \
	unzip \
	mesa-utils \
	xorg \
	openssh-server \
	inetutils-syslogd \
	&& rm -rf /var/lib/apt/lists/*

RUN mkdir -p /run/sshd

RUN echo "PermitRootLogin yes" >> /etc/ssh/sshd_config && \
    echo "PasswordAuthentication yes" >> /etc/ssh/sshd_config

ADD https://download.blender.org/release/Blender3.6/blender-3.6.5-linux-x64.tar.xz /opt/
RUN tar -xf /opt/blender-3.6.5-linux-x64.tar.xz -C /opt
RUN mv /opt/blender-3.6.5-linux-x64 /opt/blender
RUN rm /opt/blender-3.6.5-linux-x64.tar.xz
RUN ln -s /opt/blender/blender /usr/bin/blender

RUN cp /usr/lib64/xorg/modules/drivers/nvidia_drv.so /usr/lib/xorg/modules/drivers/
RUN cp /usr/lib64/xorg/modules/extensions/libglxserver_nvidia.so /usr/lib/xorg/modules/extensions/

VOLUME /golem/work /golem/input /golem/output /golem/resources
WORKDIR /golem/work
