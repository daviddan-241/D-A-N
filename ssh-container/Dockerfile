FROM ubuntu:24.04

LABEL maintainer="devbox"
LABEL description="Hardened SSH development container with common dev tools"
LABEL version="1.0"

# ── Build arguments ─────────────────────────────────────────────────────────
ARG DEV_USER=devuser
ARG DEV_UID=1000
ARG DEV_GID=1000
ARG PYTHON_VERSION=3

# ── Environment ──────────────────────────────────────────────────────────────
ENV DEBIAN_FRONTEND=noninteractive \
    TZ=UTC \
    LANG=en_US.UTF-8 \
    LC_ALL=en_US.UTF-8 \
    DEV_USER=${DEV_USER}

# ── System packages ──────────────────────────────────────────────────────────
RUN apt-get update && apt-get install -y --no-install-recommends \
    # SSH server
    openssh-server \
    # Firewall
    ufw \
    fail2ban \
    # Core utils
    curl \
    wget \
    ca-certificates \
    gnupg \
    lsb-release \
    software-properties-common \
    apt-transport-https \
    # Dev tools
    git \
    python3 \
    python3-pip \
    python3-venv \
    python3-dev \
    build-essential \
    # Editors
    vim \
    nano \
    # Terminal multiplexer & monitoring
    tmux \
    htop \
    # File utils
    tree \
    zip \
    unzip \
    # JSON & text tools
    jq \
    ripgrep \
    # Networking
    net-tools \
    iputils-ping \
    dnsutils \
    nmap \
    socat \
    # Process utils
    procps \
    lsof \
    # Misc
    sudo \
    less \
    man-db \
    locales \
    tzdata \
    logrotate \
    rsyslog \
    netcat-openbsd \
  && locale-gen en_US.UTF-8 \
  && apt-get clean \
  && rm -rf /var/lib/apt/lists/*

# ── Install Docker CLI (for Docker-in-Docker workflows) ──────────────────────
RUN install -m 0755 -d /etc/apt/keyrings \
  && curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
       | gpg --dearmor -o /etc/apt/keyrings/docker.gpg \
  && chmod a+r /etc/apt/keyrings/docker.gpg \
  && echo "deb [arch=$(dpkg --print-architecture) \
       signed-by=/etc/apt/keyrings/docker.gpg] \
       https://download.docker.com/linux/ubuntu \
       $(lsb_release -cs) stable" \
       > /etc/apt/sources.list.d/docker.list \
  && apt-get update \
  && apt-get install -y --no-install-recommends docker-ce-cli docker-compose-plugin \
  && apt-get clean \
  && rm -rf /var/lib/apt/lists/*

# ── Create non-root dev user ──────────────────────────────────────────────────
RUN groupadd --gid ${DEV_GID} ${DEV_USER} \
  && useradd \
       --uid ${DEV_UID} \
       --gid ${DEV_GID} \
       --shell /bin/bash \
       --create-home \
       --home-dir /home/${DEV_USER} \
       ${DEV_USER} \
  && echo "${DEV_USER} ALL=(ALL) NOPASSWD:ALL" > /etc/sudoers.d/${DEV_USER} \
  && chmod 0440 /etc/sudoers.d/${DEV_USER} \
  # Lock password to force key-only auth
  && passwd -l ${DEV_USER} \
  && passwd -l root

# ── SSH server directories ───────────────────────────────────────────────────
RUN mkdir -p /var/run/sshd /etc/ssh/host_keys \
  && chmod 700 /var/run/sshd

# ── SSH server configuration ─────────────────────────────────────────────────
COPY config/sshd_config /etc/ssh/sshd_config
RUN chmod 600 /etc/ssh/sshd_config

# ── Fail2ban configuration ───────────────────────────────────────────────────
COPY config/fail2ban/jail.local /etc/fail2ban/jail.local

# ── Logrotate configuration for SSH ─────────────────────────────────────────
COPY config/logrotate.d/ssh-container /etc/logrotate.d/ssh-container

# ── Message of the day ───────────────────────────────────────────────────────
COPY config/motd /etc/motd
RUN chmod 644 /etc/motd \
  && echo "PrintLastLog yes" >> /etc/ssh/sshd_config || true

# ── Shell customization for devuser ──────────────────────────────────────────
COPY config/bashrc_extra /home/${DEV_USER}/.bashrc_extra
RUN cat /home/${DEV_USER}/.bashrc_extra >> /home/${DEV_USER}/.bashrc \
  && chown ${DEV_USER}:${DEV_USER} /home/${DEV_USER}/.bashrc \
  && chown ${DEV_USER}:${DEV_USER} /home/${DEV_USER}/.bashrc_extra

# ── pip tools for devuser ─────────────────────────────────────────────────────
RUN pip3 install --no-cache-dir --break-system-packages \
    pipx \
    black \
    httpie \
  && pipx ensurepath 2>/dev/null || true

# ── Entrypoint & health check scripts ────────────────────────────────────────
COPY scripts/entrypoint.sh /entrypoint.sh
COPY scripts/healthcheck.sh /healthcheck.sh
COPY scripts/firewall-init.sh /firewall-init.sh
RUN chmod +x /entrypoint.sh /healthcheck.sh /firewall-init.sh

# ── Volumes ───────────────────────────────────────────────────────────────────
# These directories will be mounted; declare them so Docker tracks them
VOLUME ["/home/${DEV_USER}", "/etc/ssh/host_keys", "/var/log/ssh-container"]

# ── Expose SSH port ───────────────────────────────────────────────────────────
EXPOSE 22

# ── Health check ──────────────────────────────────────────────────────────────
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD /healthcheck.sh

ENTRYPOINT ["/entrypoint.sh"]
