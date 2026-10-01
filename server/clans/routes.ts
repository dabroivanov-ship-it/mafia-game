import { Router } from 'express';
import { authMiddleware } from '../auth/jwt.js';
import { isUserBanned } from '../auth/db.js';
import type { GameRoom } from '../types/index.js';
import {
  applyToClan,
  blacklistMember,
  removeFromBlacklist,
  CLAN_CREATE_MIN_POSTS,
  CLAN_CREATE_MIN_GAMES,
  createClan,
  createClanNews,
  decideApplication,
  deleteClanNews,
  dissolveClan,
  getClanById,
  getClanDetail,
  getCreateClanEligibility,
  isClanLeader,
  kickMember,
  leaveClan,
  listClanNews,
  listClanChat,
  postClanChat,
  clearClanMessages,
  listClans,
  transferLeadership,
  updateClanSettings,
  setClanLogo,
  type ClanJoinMode,
} from './store.js';
import { notifyClanAction } from './notify.js';
import { chatSocketRateLimiter } from '../security/rateLimit.js';
import { normalizeChatText } from '../security/validate.js';
import {
  clanLogoPublicPath,
  clanLogoUpload,
  deleteClanLogoFile,
} from '../upload/clanLogo.js';

export interface ClanRouteHandlers {
  createClanRoom: (name: string) => GameRoom;
  removeClanRoom: (roomId: number) => void;
  clearClanRoomChat: (roomId: number) => void;
  broadcastLobby: () => void;
  emitToClanMembers: (clanId: number, event: string, data: unknown) => void;
}

export function createClansRouter(handlers: ClanRouteHandlers) {
  const router = Router();
  router.use(authMiddleware);

  router.get('/meta', (req, res) => {
    res.json({
      createMinPosts: CLAN_CREATE_MIN_POSTS,
      createMinGames: CLAN_CREATE_MIN_GAMES,
      eligibility: getCreateClanEligibility(req.userId!),
    });
  });

  router.get('/', (req, res) => {
    try {
      res.json({
        clans: listClans(req.userId!),
        eligibility: getCreateClanEligibility(req.userId!),
        createMinPosts: CLAN_CREATE_MIN_POSTS,
        createMinGames: CLAN_CREATE_MIN_GAMES,
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

  router.post('/:clanId/logo', (req, res) => {
    if (isUserBanned(req.user)) {
      return res.status(403).json({ error: 'Аккаунт заблокирован' });
    }
    const clanId = Number(req.params.clanId);
    if (!Number.isFinite(clanId)) return res.status(400).json({ error: 'Некорректный id' });
    clanLogoUpload.single('logo')(req, res, (err) => {
      if (err) {
        return res.status(400).json({ error: err instanceof Error ? err.message : 'Ошибка загрузки' });
      }
      if (!req.file) {
        return res.status(400).json({ error: 'Выберите файл логотипа' });
      }
      try {
        const previous = getClanById(clanId)?.logo;
        const clan = setClanLogo(clanId, req.userId!, clanLogoPublicPath(req.file.filename));
        if (previous && previous !== clan.logo) deleteClanLogoFile(previous);
        res.json({ clan });
      } catch (e) {
        deleteClanLogoFile(clanLogoPublicPath(req.file.filename));
        const error = e as Error;
        res.status(400).json({ error: error.message || 'Не удалось сохранить логотип' });
      }
    });
  });

  router.delete('/:clanId/logo', (req, res) => {
    if (isUserBanned(req.user)) {
      return res.status(403).json({ error: 'Аккаунт заблокирован' });
    }
    const clanId = Number(req.params.clanId);
    if (!Number.isFinite(clanId)) return res.status(400).json({ error: 'Некорректный id' });
    try {
      const previous = getClanById(clanId)?.logo;
      const clan = setClanLogo(clanId, req.userId!, null);
      deleteClanLogoFile(previous);
      res.json({ clan });
    } catch (e) {
      const error = e as Error;
      res.status(400).json({ error: error.message || 'Не удалось убрать логотип' });
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

  router.delete('/:clanId/blacklist/:userId', (req, res) => {
    if (isUserBanned(req.user)) {
      return res.status(403).json({ error: 'Аккаунт заблокирован' });
    }
    const clanId = Number(req.params.clanId);
    const targetUserId = Number(req.params.userId);
    if (!Number.isFinite(clanId) || !Number.isFinite(targetUserId)) {
      return res.status(400).json({ error: 'Некорректные данные' });
    }
    try {
      removeFromBlacklist(clanId, req.userId!, targetUserId);
      res.json({ clan: getClanDetail(clanId, req.userId!) });
    } catch (e) {
      const err = e as Error;
      res.status(400).json({ error: err.message || 'Не удалось убрать из чёрного списка' });
    }
  });

  router.post('/:clanId/clear-chat', (req, res) => {
    if (isUserBanned(req.user)) {
      return res.status(403).json({ error: 'Аккаунт заблокирован' });
    }
    const clanId = Number(req.params.clanId);
    if (!Number.isFinite(clanId)) return res.status(400).json({ error: 'Некорректный id' });
    try {
      clearClanMessages(clanId, req.userId!);
      const clanRow = getClanById(clanId);
      if (clanRow?.room_id) {
        try {
          handlers.clearClanRoomChat(clanRow.room_id);
        } catch {
          /* комната могла уже исчезнуть */
        }
      }
      handlers.emitToClanMembers(clanId, 'clan:cleared', { clanId });
      res.json({ ok: true, clan: getClanDetail(clanId, req.userId!) });
    } catch (e) {
      const err = e as Error;
      res.status(400).json({ error: err.message || 'Не удалось очистить чат' });
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
      const previousLogo = getClanById(clanId)?.logo;
      const result = dissolveClan(clanId, req.userId!);
      deleteClanLogoFile(previousLogo);
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

  router.get('/:clanId/chat', (req, res) => {
    const clanId = Number(req.params.clanId);
    if (!Number.isFinite(clanId)) return res.status(400).json({ error: 'Некорректный id' });
    try {
      res.json({ messages: listClanChat(clanId, req.userId!) });
    } catch (e) {
      const err = e as Error;
      const status = err.message.includes('только членам') ? 403 : 400;
      res.status(status).json({ error: err.message || 'Не удалось загрузить чат' });
    }
  });

  router.post('/:clanId/chat', (req, res) => {
    if (isUserBanned(req.user)) {
      return res.status(403).json({ error: 'Аккаунт заблокирован' });
    }
    const clanId = Number(req.params.clanId);
    if (!Number.isFinite(clanId)) return res.status(400).json({ error: 'Некорректный id' });
    if (!chatSocketRateLimiter.try(`clan-chat:${req.userId}`)) {
      return res.status(429).json({ error: 'Слишком много сообщений. Подождите.' });
    }
    const text = normalizeChatText(req.body?.text);
    if (!text) return res.status(400).json({ error: 'Пустое сообщение' });
    try {
      const message = postClanChat(clanId, req.userId!, text);
      handlers.emitToClanMembers(clanId, 'clan:message', message);
      res.json({ message });
    } catch (e) {
      const err = e as Error;
      const status = err.message.includes('только члены') ? 403 : 400;
      res.status(status).json({ error: err.message || 'Не удалось отправить' });
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
