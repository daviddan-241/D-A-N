FROM ubuntu:24.04

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
    sed \
    awk \
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
    curl \
    wget \
    httpie \
    # Password & crypto
    openssl \
    gpg \
    # Process utilities
    procps \
    lsof \
    strace \
    ltrace \
    pstree \
    # Forensics base
    binwalk \
    foremost \
    dc3dd \
    xxd \
    hexdump \
    strings \
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
    # Wordlists base
    wordlists \
    seclists \
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

# ── Python security tools ─────────────────────────────────────────────────────
RUN pip3 install --no-cache-dir --break-system-packages \
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
  || pip3 install --no-cache-dir --break-system-packages \
    mitmproxy scapy requests beautifulsoup4 paramiko black httpie pipx

# ── ttyd — web terminal server ────────────────────────────────────────────────
# Download the latest ttyd binary from GitHub releases
ARG TTYD_VERSION=1.7.7
RUN curl -fsSL "https://github.com/tsl0922/ttyd/releases/download/${TTYD_VERSION}/ttyd.x86_64" \
      -o /usr/local/bin/ttyd \
  && chmod +x /usr/local/bin/ttyd \
  && ttyd --version || true

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
  && passwd -l ${DEV_USER} \
  && passwd -l root \
  # Give devuser access to Go tools
  && mkdir -p /home/${DEV_USER}/go/bin \
  && cp /root/go/bin/* /home/${DEV_USER}/go/bin/ 2>/dev/null || true \
  && chown -R ${DEV_USER}:${DEV_USER} /home/${DEV_USER}/go

# ── SSH server setup ──────────────────────────────────────────────────────────
RUN mkdir -p /var/run/sshd /etc/ssh/host_keys \
  && chmod 700 /var/run/sshd

COPY config/sshd_config /etc/ssh/sshd_config
RUN chmod 600 /etc/ssh/sshd_config

# ── fail2ban ───────────────────────────────────────────────────────────────────
COPY config/fail2ban/jail.local /etc/fail2ban/jail.local

# ── Logrotate ─────────────────────────────────────────────────────────────────
COPY config/logrotate.d/ssh-container /etc/logrotate.d/ssh-container

# ── MOTD ──────────────────────────────────────────────────────────────────────
COPY config/motd /etc/motd
RUN chmod 644 /etc/motd

# ── Shell customization ───────────────────────────────────────────────────────
COPY config/bashrc_extra /home/${DEV_USER}/.bashrc_extra
RUN cat /home/${DEV_USER}/.bashrc_extra >> /home/${DEV_USER}/.bashrc \
  && chown ${DEV_USER}:${DEV_USER} /home/${DEV_USER}/.bashrc \
  && chown ${DEV_USER}:${DEV_USER} /home/${DEV_USER}/.bashrc_extra

# ── Auto-install script (Metasploit etc. — runs at container first boot) ──────
COPY scripts/auto-install.sh /auto-install.sh
RUN chmod +x /auto-install.sh

# ── Entrypoint & helpers ──────────────────────────────────────────────────────
COPY scripts/entrypoint.sh    /entrypoint.sh
COPY scripts/healthcheck.sh   /healthcheck.sh
COPY scripts/firewall-init.sh /firewall-init.sh
RUN chmod +x /entrypoint.sh /healthcheck.sh /firewall-init.sh

# ── Persistent volumes ─────────────────────────────────────────────────────────
VOLUME ["/home/${DEV_USER}", "/etc/ssh/host_keys", "/var/log/ssh-container"]

# ── Expose ports ─────────────────────────────────────────────────────────────
EXPOSE 22    # SSH
EXPOSE 7681  # ttyd web terminal

# ── Health check ─────────────────────────────────────────────────────────────
HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
  CMD /healthcheck.sh

ENTRYPOINT ["/entrypoint.sh"]
