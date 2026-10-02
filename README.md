# Radix CMS

A hybrid CMS engine supporting **ASP.NET Core** and **Node.js (Fastify + TypeScript)** in a unified repository.

## Features
- **Flexible Engine Modes:** Run .NET only, Node only, or both simultaneously in Hybrid mode.
- **TypeScript First:** Direct execution in development via `tsx watch`, compiled to `dist/` for production.
- **Port Safeguards:** Automatic pre-flight TCP port checking before launching engines.

## Radix Node Server
- /node-server/README.md for info on Node CMS.

## Quick Start

### 1. Install Dependencies
```bash
npm install
cd node-server && npm install && cd ..
```

### 2. Development Execution
```bash
# Run configured mode from radix.config.json
npm run dev

# Explicit engine launch
npm run dev:node     # Fastify only (Port 3000)
npm run dev:dotnet   # ASP.NET Core only (Port 5000)
npm run dev:hybrid   # Run both side-by-side

# Production (Compiled dist/ JS / Release .NET binaries):
npm run start:node   # Runs pre-compiled Fastify JS.
npm run start:dotnet # Runs pre-compiled Release .NET binary.
npm run start:hybrid # Run both side-by-side
```

### 3. Production Build & Run
```bash
npm run build        # Compiles TS to /dist and builds .NET Release binary
npm run start        # Runs compiled production servers
```