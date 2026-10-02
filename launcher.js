import { spawn } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';

const configPath = path.resolve(process.cwd(), 'radix.config.json');

if (!fs.existsSync(configPath)) {
  console.error('❌ Error: radix.config.json not found in root directory.');
  process.exit(1);
}

const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

// Check command line flags
const modeArg = process.argv.find((arg) => arg.startsWith('--mode='));
const envArg = process.argv.find((arg) => arg.startsWith('--env='));

const mode = modeArg ? modeArg.split('=')[1] : config.mode;
const isProd = envArg ? envArg.split('=')[1] === 'prod' : false;

const dotnetPort = Number(config.ports?.dotnet) || 5000;
const nodePort = Number(config.ports?.node) || 3000;

/**
 * Checks if a TCP port is free.
 */
function isPortAvailable(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => resolve(false));
    server.once('listening', () => {
      server.close(() => resolve(true));
    });
    server.listen(port, '0.0.0.0');
  });
}

const processes = [];

function startDotnet() {
  const command = isProd
    ? ['run', '--project', './dotnet-server', '--configuration', 'Release']
    : ['run', '--project', './dotnet-server'];

  console.log(`[Radix] Starting .NET Engine on port ${dotnetPort}...`);
  const dotnet = spawn('dotnet', command, {
    stdio: 'inherit',
    shell: true,
    env: { ...process.env, PORT: dotnetPort }
  });
  processes.push(dotnet);
}

function startNode() {
  const script = isProd ? 'start' : 'dev';
  console.log(`[Radix] Starting Fastify Node Engine on port ${nodePort}...`);
  const node = spawn('npm', ['--prefix', './node-server', 'run', script], {
    stdio: 'inherit',
    shell: true,
    env: { ...process.env, PORT: nodePort }
  });
  processes.push(node);
}

async function main() {
  console.log(`\n🚀 [Radix CMS] Booting in [${mode.toUpperCase()}] mode (${isProd ? 'PRODUCTION' : 'DEVELOPMENT'})...\n`);

  // Validate Port Availability Before Launching
  if (mode === 'dotnet' || mode === 'hybrid') {
    const dotnetFree = await isPortAvailable(dotnetPort);
    if (!dotnetFree) {
      console.error(`❌ Port ${dotnetPort} is already in use. Cannot start .NET Engine.`);
      process.exit(1);
    }
  }

  if (mode === 'node' || mode === 'hybrid') {
    const nodeFree = await isPortAvailable(nodePort);
    if (!nodeFree) {
      console.error(`❌ Port ${nodePort} is already in use. Cannot start Node Engine.`);
      process.exit(1);
    }
  }

  // Execute Process Bootup
  if (mode === 'dotnet') {
    startDotnet();
  } else if (mode === 'node') {
    startNode();
  } else if (mode === 'hybrid') {
    startDotnet();
    startNode();
  } else {
    console.error(`❌ Invalid mode "${mode}". Use "dotnet", "node", or "hybrid".`);
    process.exit(1);
  }
}

// Graceful process exit
const cleanExit = () => {
  processes.forEach((proc) => {
    if (proc && !proc.killed) proc.kill();
  });
  process.exit();
};

process.on('SIGINT', cleanExit);
process.on('SIGTERM', cleanExit);

main();