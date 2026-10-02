import fs from 'fs';
import path from 'path';
import { Application } from 'express';

type CustomCodeModule = {
  register: (context: { app: Application; db: unknown }) => void | Promise<void>;
};

export async function loadCustomCode(app: Application, db: unknown): Promise<void> {
  const customCodePath = path.join(process.cwd(), 'custom-code', 'index.js');

  if (!fs.existsSync(customCodePath)) {
    return;
  }

  const customCode = require(customCodePath) as Partial<CustomCodeModule>;

  if (typeof customCode.register !== 'function') {
    throw new Error(
      `Custom code module must export register(context): ${customCodePath}`
    );
  }

  await customCode.register({ app, db });
  console.log(`[Radix Custom Code Loaded]: ${customCodePath}`);
}
