import app from '../server/index.ts';

export default function handler(req: any, res: any) {
  return app(req, res);
}
