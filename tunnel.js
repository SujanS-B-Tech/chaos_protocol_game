const localtunnel = require("localtunnel");
const https = require("https");

let activeTunnel = null;
let currentPublicIp = null;

async function getPublicIp() {
  if (currentPublicIp) return currentPublicIp;
  return new Promise(resolve => {
    const req = https.get("https://api.ipify.org", { timeout: 3500 }, res => {
      let data = "";
      res.on("data", chunk => (data += chunk));
      res.on("end", () => {
        currentPublicIp = data.trim();
        resolve(currentPublicIp);
      });
    });
    req.on("error", () => resolve(null));
    req.on("timeout", () => {
      req.destroy();
      resolve(null);
    });
  });
}

async function startTunnel(port, options = {}) {
  if (activeTunnel && activeTunnel.url) {
    const ip = currentPublicIp || (await getPublicIp());
    return {
      url: activeTunnel.url,
      ip,
      active: true
    };
  }

  try {
    const [ip, tunnel] = await Promise.all([
      getPublicIp().catch(() => null),
      localtunnel({ port, ...options })
    ]);

    activeTunnel = tunnel;

    tunnel.on("close", () => {
      console.log("[Tunnel] Public tunnel closed.");
      activeTunnel = null;
    });

    tunnel.on("error", err => {
      console.warn("[Tunnel] Public tunnel error:", err.message);
    });

    return {
      url: tunnel.url,
      ip,
      active: true
    };
  } catch (err) {
    console.error("[Tunnel] Failed to start tunnel:", err.message);
    throw err;
  }
}

async function stopTunnel() {
  if (activeTunnel) {
    try {
      activeTunnel.close();
    } catch (_) {}
    activeTunnel = null;
  }
  return { active: false };
}

function getTunnelStatus() {
  return {
    active: !!(activeTunnel && activeTunnel.url),
    url: activeTunnel ? activeTunnel.url : null,
    ip: currentPublicIp
  };
}

module.exports = {
  startTunnel,
  stopTunnel,
  getTunnelStatus,
  getPublicIp
};
