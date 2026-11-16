import type { Request, Response } from 'express';
import { idParamSchema } from '@appeal/shared';
import { authOf } from '../../middleware/auth.js';
import type { OrgService } from './org.service.js';

export function orgController(service: OrgService) {
  const ctx = (req: Request) => ({ auth: authOf(req), ip: req.ip });
  const id = (req: Request) => idParamSchema.parse(req.params).id;

  return {
    async getOrg(req: Request, res: Response) {
      res.json(await service.getOrg(ctx(req)));
    },
    async listUsers(req: Request, res: Response) {
      res.json(await service.listUsers(ctx(req), req.query));
    },
    async getUser(req: Request, res: Response) {
      res.json(await service.getUser(ctx(req), id(req)));
    },
    async updateRole(req: Request, res: Response) {
      res.json(await service.updateRole(ctx(req), id(req), req.body));
    },
    async listInvites(req: Request, res: Response) {
      res.json({ data: await service.listInvites(ctx(req)) });
    },
    async createInvite(req: Request, res: Response) {
      res.status(201).json(await service.createInvite(ctx(req), req.body));
    },
    async revokeInvite(req: Request, res: Response) {
      await service.revokeInvite(ctx(req), id(req));
      res.status(204).end();
    },
  };
}
