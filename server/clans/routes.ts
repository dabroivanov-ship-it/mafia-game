import { Router } from 'express';
import { authMiddleware } from '../auth/jwt.js';
import { isUserBanned } from '../auth/db.js';
import type { GameRoom } from '../types/index.js';
import {
  applyToClan,
  blacklistMember,
  CLAN_CREATE_MIN_POSTS,
  createClan,
  createClanNews,
  decideApplication,
  deleteClanNews,
  dissolveClan,
  getClanById,
  getClanDetail,
  getCreateClanEligibility,
  kickMember,
  leaveClan,
  listClanNews,
  listClans,
  transferLeadership,
  updateClanSettings,
  type ClanJoinMode,
} from './store.js';
import { notifyClanAction } from './notify.js';

export interface ClanRouteHandlers {
  createClanRoom: (name: string) => GameRoom;
  removeClanRoom: (roomId: number) => void;
  broadcastLobby: () => void;
}

export function createClansRouter(handlers: ClanRouteHandlers) {
  const router = Router();
  router.use(authMiddleware);

  router.get('/meta', (req, res) => {
    res.json({
      createMinPosts: CLAN_CREATE_MIN_POSTS,
      eligibility: getCreateClanEligibility(req.userId!),
    });
  });

  router.get('/', (req, res) => {
    try {
      res.json({
        clans: listClans(req.userId!),
        eligibility: getCreateClanEligibility(req.userId!),
        createMinPosts: CLAN_CREATE_MIN_POSTS,
      });
    } catch (e) {
      const err = e as Error;
      res.status(500).json({ error: err.message || 'Не удалось загрузить кланы' });
    }
  });

  router.get('/:clanId', (req, res) => {
    const clanId = Number(req.params.clanId);
    if (!Number.isFinite(clanId)) return res.status(400).json({ error: 'Некорректный id' });
    const clan = getClanDetail(clanId, req.userId!);
    if (!clan) return res.status(404).json({ error: 'Клан не найден' });
    res.json({ clan });
  });

  router.post('/', (req, res) => {
    if (isUserBanned(req.user)) {
      return res.status(403).json({ error: 'Аккаунт заблокирован' });
    }
    let room: GameRoom | null = null;
    try {
      const name = String(req.body?.name ?? '');
      const description = String(req.body?.description ?? '');
      const joinMode = (req.body?.joinMode === 'open' ? 'open' : 'approval') as ClanJoinMode;
      room = handlers.createClanRoom(name.trim() || 'Клан');
      const clan = createClan(
        req.userId!,
        { name, description, joinMode },
        room.id
      );
      handlers.broadcastLobby();
      res.status(201).json({ clan });
    } catch (e) {
      if (room) {
        try {
          handlers.removeClanRoom(room.id);
        } catch {
          /* ignore */
        }
      }
      const err = e as Error;
      res.status(400).json({ error: err.message || 'Не удалось создать клан' });
    }
  });

  router.patch('/:clanId', (req, res) => {
    if (isUserBanned(req.user)) {
      return res.status(403).json({ error: 'Аккаунт заблокирован' });
    }
    const clanId = Number(req.params.clanId);
    if (!Number.isFinite(clanId)) return res.status(400).json({ error: 'Некорректный id' });
    try {
      const clan = updateClanSettings(clanId, req.userId!, {
        description: req.body?.description,
        joinMode: req.body?.joinMode,
      });
      res.json({ clan });
    } catch (e) {
      const err = e as Error;
      res.status(400).json({ error: err.message || 'Не удалось сохранить' });
    }
  });

  router.post('/:clanId/apply', (req, res) => {
    if (isUserBanned(req.user)) {
      return res.status(403).json({ error: 'Аккаунт заблокирован' });
    }
    const clanId = Number(req.params.clanId);
    if (!Number.isFinite(clanId)) return res.status(400).json({ error: 'Некорректный id' });
    try {
      const result = applyToClan(clanId, req.userId!);
      const clan = getClanDetail(clanId, req.userId!);
      res.json({ ...result, clan });
    } catch (e) {
      const err = e as Error;
      res.status(400).json({ error: err.message || 'Не удалось подать заявку' });
    }
  });

  router.post('/:clanId/applications/:applicationId/decide', (req, res) => {
    if (isUserBanned(req.user)) {
      return res.status(403).json({ error: 'Аккаунт заблокирован' });
    }
    const clanId = Number(req.params.clanId);
    const applicationId = Number(req.params.applicationId);
    const decision = String(req.body?.decision || '');
    if (!Number.isFinite(clanId) || !Number.isFinite(applicationId)) {
      return res.status(400).json({ error: 'Некорректные данные' });
    }
    if (decision !== 'approve' && decision !== 'reject' && decision !== 'ban') {
      return res.status(400).json({ error: 'Некорректное решение' });
    }
    try {
      const result = decideApplication(clanId, req.userId!, applicationId, decision);
      const clanRow = getClanById(clanId);
      const clanName = clanRow?.name || 'клан';
      if (decision === 'ban') {
        notifyClanAction(
          req.userId!,
          result.targetUserId,
          `Вашу заявку в клан «${clanName}» отклонили и добавили вас в чёрный список. Повторная заявка невозможна.`
        );
      } else if (decision === 'reject') {
        notifyClanAction(
          req.userId!,
          result.targetUserId,
          `Вашу заявку в клан «${clanName}» отклонили.`
        );
      }
      const clan = getClanDetail(clanId, req.userId!);
      res.json({ clan });
    } catch (e) {
      const err = e as Error;
      res.status(400).json({ error: err.message || 'Не удалось обработать заявку' });
    }
  });

  router.post('/:clanId/leave', (req, res) => {
    if (isUserBanned(req.user)) {
      return res.status(403).json({ error: 'Аккаунт заблокирован' });
    }
    const clanId = Number(req.params.clanId);
    if (!Number.isFinite(clanId)) return res.status(400).json({ error: 'Некорректный id' });
    try {
      const result = leaveClan(req.userId!);
      if (result.clanId !== clanId) {
        return res.status(400).json({ error: 'Вы не в этом клане' });
      }
      if (result.dissolved && result.roomId) {
        try {
          handlers.removeClanRoom(result.roomId);
        } catch {
          /* ignore */
        }
        handlers.broadcastLobby();
      }
      res.json({ ok: true, dissolved: result.dissolved });
    } catch (e) {
      const err = e as Error;
      res.status(400).json({ error: err.message || 'Не удалось выйти' });
    }
  });

  router.post('/:clanId/kick', (req, res) => {
    if (isUserBanned(req.user)) {
      return res.status(403).json({ error: 'Аккаунт заблокирован' });
    }
    const clanId = Number(req.params.clanId);
    const targetUserId = Number(req.body?.userId);
    if (!Number.isFinite(clanId) || !Number.isFinite(targetUserId)) {
      return res.status(400).json({ error: 'Некорректные данные' });
    }
    try {
      const clanRow = getClanById(clanId);
      kickMember(clanId, req.userId!, targetUserId);
      notifyClanAction(
        req.userId!,
        targetUserId,
        `Вас исключили из клана «${clanRow?.name || 'клан'}».`
      );
      res.json({ clan: getClanDetail(clanId, req.userId!) });
    } catch (e) {
      const err = e as Error;
      res.status(400).json({ error: err.message || 'Не удалось исключить' });
    }
  });

  router.post('/:clanId/blacklist', (req, res) => {
    if (isUserBanned(req.user)) {
      return res.status(403).json({ error: 'Аккаунт заблокирован' });
    }
    const clanId = Number(req.params.clanId);
    const targetUserId = Number(req.body?.userId);
    if (!Number.isFinite(clanId) || !Number.isFinite(targetUserId)) {
      return res.status(400).json({ error: 'Некорректные данные' });
    }
    try {
      const clanRow = getClanById(clanId);
      blacklistMember(clanId, req.userId!, targetUserId);
      notifyClanAction(
        req.userId!,
        targetUserId,
        `Вас исключили из клана «${clanRow?.name || 'клан'}» и добавили в чёрный список. Повторная заявка невозможна.`
      );
      res.json({ clan: getClanDetail(clanId, req.userId!) });
    } catch (e) {
      const err = e as Error;
      res.status(400).json({ error: err.message || 'Не удалось добавить в чёрный список' });
    }
  });

  router.post('/:clanId/transfer', (req, res) => {
    if (isUserBanned(req.user)) {
      return res.status(403).json({ error: 'Аккаунт заблокирован' });
    }
    const clanId = Number(req.params.clanId);
    const newLeaderId = Number(req.body?.userId);
    if (!Number.isFinite(clanId) || !Number.isFinite(newLeaderId)) {
      return res.status(400).json({ error: 'Некорректные данные' });
    }
    try {
      transferLeadership(clanId, req.userId!, newLeaderId);
      res.json({ clan: getClanDetail(clanId, req.userId!) });
    } catch (e) {
      const err = e as Error;
      res.status(400).json({ error: err.message || 'Не удалось передать главенство' });
    }
  });

  router.post('/:clanId/dissolve', (req, res) => {
    if (isUserBanned(req.user)) {
      return res.status(403).json({ error: 'Аккаунт заблокирован' });
    }
    const clanId = Number(req.params.clanId);
    if (!Number.isFinite(clanId)) return res.status(400).json({ error: 'Некорректный id' });
    try {
      const result = dissolveClan(clanId, req.userId!);
      if (result.roomId) {
        try {
          handlers.removeClanRoom(result.roomId);
        } catch {
          /* ignore */
        }
        handlers.broadcastLobby();
      }
      res.json({ ok: true });
    } catch (e) {
      const err = e as Error;
      res.status(400).json({ error: err.message || 'Не удалось распустить клан' });
    }
  });

  router.get('/:clanId/news', (req, res) => {
    const clanId = Number(req.params.clanId);
    if (!Number.isFinite(clanId)) return res.status(400).json({ error: 'Некорректный id' });
    try {
      res.json({ news: listClanNews(clanId, req.userId!) });
    } catch (e) {
      const err = e as Error;
      res.status(403).json({ error: err.message || 'Нет доступа' });
    }
  });

  router.post('/:clanId/news', (req, res) => {
    if (isUserBanned(req.user)) {
      return res.status(403).json({ error: 'Аккаунт заблокирован' });
    }
    const clanId = Number(req.params.clanId);
    if (!Number.isFinite(clanId)) return res.status(400).json({ error: 'Некорректный id' });
    try {
      const item = createClanNews(clanId, req.userId!, {
        title: String(req.body?.title ?? ''),
        body: String(req.body?.body ?? ''),
      });
      res.status(201).json({ news: item });
    } catch (e) {
      const err = e as Error;
      res.status(400).json({ error: err.message || 'Не удалось опубликовать' });
    }
  });

  router.delete('/:clanId/news/:newsId', (req, res) => {
    if (isUserBanned(req.user)) {
      return res.status(403).json({ error: 'Аккаунт заблокирован' });
    }
    const clanId = Number(req.params.clanId);
    const newsId = Number(req.params.newsId);
    if (!Number.isFinite(clanId) || !Number.isFinite(newsId)) {
      return res.status(400).json({ error: 'Некорректные данные' });
    }
    try {
      deleteClanNews(clanId, newsId, req.userId!);
      res.json({ ok: true });
    } catch (e) {
      const err = e as Error;
      res.status(400).json({ error: err.message || 'Не удалось удалить' });
    }
  });

  return router;
}
