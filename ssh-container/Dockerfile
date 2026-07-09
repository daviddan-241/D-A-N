# ─────────────────────────────────────────────────────────────────────────────
# Stage 1: build the web app (dan-ui static frontend + api-server bundle)
# Build context for this Dockerfile is the repo root (see render.yaml).
# ─────────────────────────────────────────────────────────────────────────────
FROM node:24-slim AS webbuild

RUN corepack enable && corepack prepare pnpm@10 --activate
WORKDIR /workspace

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY tsconfig.base.json tsconfig.json ./
COPY lib/ ./lib/
COPY artifacts/api-server/ ./artifacts/api-server/
COPY artifacts/dan-ui/ ./artifacts/dan-ui/
COPY attached_assets/ ./attached_assets/

RUN pnpm install --frozen-lockfile
RUN pnpm --filter @workspace/api-server run build
RUN BASE_PATH=/ PORT=3000 pnpm --filter @workspace/dan-ui run build

# ─────────────────────────────────────────────────────────────────────────────
# Stage 2: the D.A.N. runtime image — API + UI + web terminal + SSH, one process
# ─────────────────────────────────────────────────────────────────────────────
FROM ubuntu:24.04 AS final

LABEL maintainer="daviddan-241"
LABEL description="D.A.N. — Dynamic Access Node: hardened SSH + security research container"
LABEL version="2.0"

# ── Build arguments ─────────────────────────────────────────────────────────
ARG DEV_USER=devuser
ARG DEV_UID=1000
ARG DEV_GID=1000

# ── Environment ──────────────────────────────────────────────────────────────
ENV DEBIAN_FRONTEND=noninteractive \
    TZ=UTC \
    LANG=en_US.UTF-8 \
    LC_ALL=en_US.UTF-8 \
    DEV_USER=${DEV_USER} \
    GOPATH=/home/${DEV_USER}/go \
    GOROOT=/usr/local/go \
    PATH=/usr/local/go/bin:/home/${DEV_USER}/go/bin:/usr/local/bin:${PATH}

# ── System + base packages ───────────────────────────────────────────────────
RUN apt-get update && apt-get install -y --no-install-recommends \
    # SSH server
    openssh-server \
    # Firewall & brute-force protection
    ufw \
    fail2ban \
    # Core utilities
    curl \
    wget \
    ca-certificates \
    gnupg \
    lsb-release \
    software-properties-common \
    apt-transport-https \
    # Developer tools
    git \
    python3 \
    python3-pip \
    python3-venv \
    python3-dev \
    python3-setuptools \
    python3-wheel \
    build-essential \
    gcc \
    g++ \
    make \
    cmake \
    pkg-config \
    # Editors
    vim \
    nano \
    # Terminal multiplexer & monitoring
    tmux \
    htop \
    screen \
    # File utilities
    tree \
    zip \
    unzip \
    p7zip-full \
    tar \
    gzip \
    bzip2 \
    xz-utils \
    # Text & data tools
    jq \
    ripgrep \
    gawk \
    # Scripting
    perl \
    ruby \
    ruby-dev \
    # Network utilities
    net-tools \
    iputils-ping \
    dnsutils \
    iproute2 \
    iptables \
    nmap \
    netcat-openbsd \
    socat \
    tcpdump \
    tshark \
    wireshark-common \
    proxychains4 \
    whois \
    traceroute \
    mtr \
    ncat \
    # Web tools
    httpie \
    # Anonymity / Tor
    tor \
    torsocks \
    # Password & crypto
    openssl \
    # Process utilities
    procps \
    lsof \
    strace \
    ltrace \
    psmisc \
    # Forensics base
    binwalk \
    foremost \
    dc3dd \
    xxd \
    bsdextrautils \
    binutils \
    file \
    # Misc system
    sudo \
    less \
    man-db \
    locales \
    tzdata \
    logrotate \
    rsyslog \
    cron \
    at \
  && locale-gen en_US.UTF-8 \
  && apt-get clean \
  && rm -rf /var/lib/apt/lists/*

# ── Security / pentesting tools (Kali mirrors for Ubuntu 24.04) ──────────────
# These are available directly from Kali or standard Ubuntu repos
RUN apt-get update && apt-get install -y --no-install-recommends \
    # Web application testing
    nikto \
    sqlmap \
    dirb \
    wfuzz \
    whatweb \
    # Password attacks
    john \
    hydra \
    medusa \
    hashcat \
    hashid \
    # Network reconnaissance
    masscan \
    arp-scan \
    netdiscover \
    # Exploitation
    exploitdb \
    # Wireless (hardware-dependent but installed for compatibility)
    aircrack-ng \
    # Misc security
    steghide \
    exiftool \
    # SSL/TLS testing
    sslscan \
    testssl.sh \
    # OSINT
    theharvester \
    recon-ng \
  && apt-get clean \
  && rm -rf /var/lib/apt/lists/* \
  || true   # Some packages may not exist on Ubuntu 24.04; build continues

# ── Second pass for packages that need separate install ──────────────────────
RUN apt-get update && apt-get install -y --no-install-recommends \
    nikto \
    sqlmap \
    dirb \
    wfuzz \
    whatweb \
    john \
    hydra \
    hashcat \
    masscan \
    aircrack-ng \
  && apt-get clean \
  && rm -rf /var/lib/apt/lists/* \
  || true

# ── Text-mode browsers ────────────────────────────────────────────────────────
RUN apt-get update && apt-get install -y --no-install-recommends \
    lynx \
    w3m \
    w3m-img \
    elinks \
    links2 \
  && apt-get clean \
  && rm -rf /var/lib/apt/lists/*

# ── Chromium (headless) ───────────────────────────────────────────────────────
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium-browser \
    chromium-chromedriver \
  && apt-get clean \
  && rm -rf /var/lib/apt/lists/* \
  || (apt-get install -y --no-install-recommends chromium chromium-driver \
      && apt-get clean && rm -rf /var/lib/apt/lists/*) \
  || true

# ── Go installation ───────────────────────────────────────────────────────────
ARG GO_VERSION=1.22.4
RUN curl -fsSL "https://go.dev/dl/go${GO_VERSION}.linux-amd64.tar.gz" \
      | tar -C /usr/local -xz \
  && /usr/local/go/bin/go version

# ── Go-based security tools ───────────────────────────────────────────────────
ENV PATH="/usr/local/go/bin:/root/go/bin:${PATH}"
RUN /usr/local/go/bin/go install github.com/OJ/gobuster/v3@latest 2>/dev/null || true
RUN /usr/local/go/bin/go install github.com/ffuf/ffuf/v2@latest      2>/dev/null || true
RUN /usr/local/go/bin/go install github.com/projectdiscovery/subfinder/v2/cmd/subfinder@latest 2>/dev/null || true
RUN /usr/local/go/bin/go install github.com/projectdiscovery/httpx/cmd/httpx@latest            2>/dev/null || true
RUN /usr/local/go/bin/go install github.com/projectdiscovery/nuclei/v3/cmd/nuclei@latest       2>/dev/null || true
RUN /usr/local/go/bin/go install github.com/projectdiscovery/dnsx/cmd/dnsx@latest              2>/dev/null || true
RUN /usr/local/go/bin/go install github.com/tomnomnom/waybackurls@latest 2>/dev/null || true
RUN /usr/local/go/bin/go install github.com/tomnomnom/httprobe@latest    2>/dev/null || true
RUN /usr/local/go/bin/go install github.com/lc/gau/v2/cmd/gau@latest    2>/dev/null || true
# Copy Go binaries from root to /usr/local/bin so devuser can access them
RUN cp /root/go/bin/* /usr/local/bin/ 2>/dev/null || true

# ── Build deps for python packages that compile from source (yara-python, etc.) ─
RUN apt-get update && apt-get install -y --no-install-recommends \
    libssl-dev \
    libffi-dev \
    automake \
    libtool \
    bison \
    flex \
    autoconf \
    libjansson-dev \
    libmagic-dev \
  && apt-get clean \
  && rm -rf /var/lib/apt/lists/*

# ── Python security tools ─────────────────────────────────────────────────────
# Installed one-by-one so a single package failing to build (e.g. yara-python
# needing extra native deps) doesn't abort the whole image build.
RUN for pkg in \
      mitmproxy \
      impacket \
      scapy \
      shodan \
      requests \
      beautifulsoup4 \
      paramiko \
      pwntools \
      pycryptodome \
      pefile \
      oletools \
      yara-python \
      volatility3 \
      black \
      httpie \
      pipx \
      aider-chat \
    ; do \
      pip3 install --no-cache-dir --break-system-packages "$pkg" \
        || echo "WARN: pip package '$pkg' failed to install, skipping"; \
    done

# ── Ensure aider is on PATH ───────────────────────────────────────────────────
RUN pip3 install --no-cache-dir --break-system-packages aider-chat 2>/dev/null || true \
  && ln -sf "$(python3 -c 'import site; print(site.getsitepackages()[0])')/bin/aider" \
       /usr/local/bin/aider 2>/dev/null || true

# ── cloudflared (Cloudflare Tunnel — free SSH through HTTPS) ─────────────────
# Lets you SSH into this container from anywhere without open ports.
# Usage: set CLOUDFLARE_TUNNEL_TOKEN env var in Render dashboard.
RUN curl -fsSL \
      "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64" \
      -o /usr/local/bin/cloudflared \
  && chmod +x /usr/local/bin/cloudflared \
  && cloudflared --version 2>/dev/null || true

# ── bore (instant TCP tunnel — zero-config SSH fallback) ─────────────────────
# bore local 22 --to bore.pub  →  ssh -p <PORT> devuser@bore.pub
# Use BORE_SECRET env var for a consistent port across restarts.
ARG BORE_VERSION=0.5.0
RUN curl -fsSL \
      "https://github.com/ekzhang/bore/releases/download/v${BORE_VERSION}/bore-v${BORE_VERSION}-x86_64-unknown-linux-musl.tar.gz" \
      -o /tmp/bore.tar.gz \
  && tar xzf /tmp/bore.tar.gz -C /usr/local/bin/ \
  && chmod +x /usr/local/bin/bore \
  && rm /tmp/bore.tar.gz \
  && bore --version 2>/dev/null || true

# ── ttyd — web terminal server ────────────────────────────────────────────────
# Download the latest ttyd binary from GitHub releases
ARG TTYD_VERSION=1.7.7
RUN curl -fsSL "https://github.com/tsl0922/ttyd/releases/download/${TTYD_VERSION}/ttyd.x86_64" \
      -o /usr/local/bin/ttyd \
  && chmod +x /usr/local/bin/ttyd \
  && ttyd --version || true

# ── Node.js runtime (runs the bundled api-server + serves the built dan-ui) ──
ARG NODE_MAJOR=24
RUN mkdir -p /etc/apt/keyrings \
  && curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | bash - \
  && apt-get install -y --no-install-recommends nodejs \
  && apt-get clean \
  && rm -rf /var/lib/apt/lists/* \
  && node --version && npm --version

# ── Docker CLI (for DinD workflows) ──────────────────────────────────────────
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

# ── Non-root developer user ───────────────────────────────────────────────────
# Resilient to base-image GID/UID collisions: reuse an existing group/user with
# the requested ID instead of failing, so `useradd`/`chown` always succeed.
RUN if getent group ${DEV_GID} > /dev/null; then \
      EXISTING_GROUP=$(getent group ${DEV_GID} | cut -d: -f1); \
    else \
      groupadd --gid ${DEV_GID} ${DEV_USER}; \
      EXISTING_GROUP=${DEV_USER}; \
    fi \
  && if getent passwd ${DEV_UID} > /dev/null; then \
       EXISTING_USER=$(getent passwd ${DEV_UID} | cut -d: -f1); \
       usermod -l ${DEV_USER} -d /home/${DEV_USER} -m -s /bin/bash "${EXISTING_USER}" 2>/dev/null || true; \
     else \
       useradd \
         --uid ${DEV_UID} \
         --gid "${EXISTING_GROUP}" \
         --shell /bin/bash \
         --create-home \
         --home-dir /home/${DEV_USER} \
         ${DEV_USER}; \
     fi \
  && mkdir -p /home/${DEV_USER} \
  && echo "${DEV_USER} ALL=(ALL) NOPASSWD:ALL" > /etc/sudoers.d/${DEV_USER} \
  && chmod 0440 /etc/sudoers.d/${DEV_USER} \
  && passwd -l ${DEV_USER} \
  && passwd -l root \
  # Give devuser access to Go tools
  && mkdir -p /home/${DEV_USER}/go/bin \
  && cp /root/go/bin/* /home/${DEV_USER}/go/bin/ 2>/dev/null || true \
  && chown -R ${DEV_USER}:${DEV_USER} /home/${DEV_USER}

# ── SSH server setup ──────────────────────────────────────────────────────────
RUN mkdir -p /var/run/sshd /etc/ssh/host_keys \
  && chmod 700 /var/run/sshd

COPY ssh-container/config/sshd_config /etc/ssh/sshd_config
RUN chmod 600 /etc/ssh/sshd_config

# ── Tor configuration ─────────────────────────────────────────────────────────
COPY ssh-container/config/torrc /etc/tor/torrc
RUN mkdir -p /var/log/tor /var/lib/tor \
  && chown -R debian-tor:debian-tor /var/log/tor /var/lib/tor 2>/dev/null || true

# ── proxychains4 configuration ────────────────────────────────────────────────
COPY ssh-container/config/proxychains4.conf /etc/proxychains4.conf

# ── fail2ban ───────────────────────────────────────────────────────────────────
COPY ssh-container/config/fail2ban/jail.local /etc/fail2ban/jail.local

# ── Logrotate ─────────────────────────────────────────────────────────────────
COPY ssh-container/config/logrotate.d/ssh-container /etc/logrotate.d/ssh-container

# ── MOTD ──────────────────────────────────────────────────────────────────────
COPY ssh-container/config/motd /etc/motd
RUN chmod 644 /etc/motd

# ── Shell customization ───────────────────────────────────────────────────────
COPY ssh-container/config/bashrc_extra   /home/${DEV_USER}/.bashrc_extra
COPY ssh-container/config/aider.conf.yml /home/${DEV_USER}/.aider.conf.yml
RUN cat /home/${DEV_USER}/.bashrc_extra >> /home/${DEV_USER}/.bashrc \
  && chown ${DEV_USER}:${DEV_USER} /home/${DEV_USER}/.bashrc \
  && chown ${DEV_USER}:${DEV_USER} /home/${DEV_USER}/.bashrc_extra \
  && chown ${DEV_USER}:${DEV_USER} /home/${DEV_USER}/.aider.conf.yml

# ── Auto-install script (Metasploit etc. — runs at container first boot) ──────
COPY ssh-container/scripts/auto-install.sh /auto-install.sh
RUN chmod +x /auto-install.sh

# ── AI Agent launcher + GitHub persistence ────────────────────────────────────
RUN mkdir -p /scripts
COPY ssh-container/scripts/dan-agents.sh    /scripts/dan-agents.sh
COPY ssh-container/scripts/dotfiles-sync.sh /scripts/dotfiles-sync.sh
COPY ssh-container/scripts/agent-memory.sh  /scripts/agent-memory.sh
RUN chmod +x /scripts/dan-agents.sh /scripts/dotfiles-sync.sh /scripts/agent-memory.sh \
  && ln -sf /scripts/dan-agents.sh    /usr/local/bin/dan-agents \
  && ln -sf /scripts/dotfiles-sync.sh /usr/local/bin/dotfiles-sync \
  && ln -sf /scripts/agent-memory.sh  /usr/local/bin/dan-memory

# ── Entrypoint & helpers ──────────────────────────────────────────────────────
COPY ssh-container/scripts/entrypoint.sh    /entrypoint.sh
COPY ssh-container/scripts/healthcheck.sh   /healthcheck.sh
COPY ssh-container/scripts/firewall-init.sh /firewall-init.sh
RUN chmod +x /entrypoint.sh /healthcheck.sh /firewall-init.sh

# ── D.A.N. web app (API + built UI) — the single process Render talks to ─────
# ttyd is proxied through the API server at /webterm so everything rides on
# the one $PORT Render exposes for this service.
WORKDIR /app
COPY --from=webbuild /workspace/artifacts/api-server/dist    ./dist
COPY --from=webbuild /workspace/artifacts/dan-ui/dist/public ./public

# ── Persistent volumes ─────────────────────────────────────────────────────────
VOLUME ["/home/${DEV_USER}", "/etc/ssh/host_keys", "/var/log/ssh-container"]

# ── Expose ports ─────────────────────────────────────────────────────────────
# Render only routes traffic to $PORT (the Node app). SSH (22) and ttyd (7681,
# internal only) stay reachable via the tunnels configured in entrypoint.sh.
# SSH
EXPOSE 22

# ttyd web terminal (internal — proxied by the app at /webterm)
EXPOSE 7681

# Node app — Render injects the real $PORT at runtime
EXPOSE 8080

# ── Health check ─────────────────────────────────────────────────────────────
HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
  CMD /healthcheck.sh

ENTRYPOINT ["/entrypoint.sh"]
