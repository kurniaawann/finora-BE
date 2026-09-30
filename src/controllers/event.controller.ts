import type { Request, Response } from 'express';

import { toEventDetailDTO, toEventListItemDTO } from '../dtos/event.dto.js';
import {
  addEventMembers,
  createEvent,
  deleteEvent,
  getEvent,
  listEvents,
  removeEventMember,
  updateEvent,
} from '../services/event.service.js';
import { getAuthenticatedUserId, getParam } from '../utils/auth.js';
import {
  parseDateRangeFilter,
  parseEnumFilter,
  parseSearchQuery,
} from '../utils/filters.js';
import { buildPaginationMeta, parsePagination } from '../utils/pagination.js';
import { success } from '../utils/response.js';
import { EVENT_STATUSES } from '../validators/event.validator.js';

export const listGroupEventsController = async (
  req: Request,
  res: Response,
) => {
  const pagination = parsePagination(req.query);
  const { from, to } = parseDateRangeFilter(req.query);

  const result = await listEvents(
    getAuthenticatedUserId(req),
    getParam(req, 'groupId'),
    pagination,
    {
      search: parseSearchQuery(req.query),
      status: parseEnumFilter(req.query, 'status', EVENT_STATUSES),
      from,
      to,
    },
  );

  return success(res, 200, 'Daftar acara berhasil diambil', {
    data: result.data.map(toEventListItemDTO),
    pagination: buildPaginationMeta(pagination, result.total),
  });
};

export const createGroupEventController = async (
  req: Request,
  res: Response,
) => {
  const event = await createEvent(
    getAuthenticatedUserId(req),
    getParam(req, 'groupId'),
    req.body,
  );

  return success(res, 201, 'Acara berhasil dibuat', {
    data: toEventDetailDTO(event),
  });
};

export const getEventController = async (req: Request, res: Response) => {
  const event = await getEvent(getAuthenticatedUserId(req), getParam(req, 'id'));

  return success(res, 200, 'Acara berhasil diambil', {
    data: toEventDetailDTO(event),
  });
};

export const updateEventController = async (req: Request, res: Response) => {
  const event = await updateEvent(
    getAuthenticatedUserId(req),
    getParam(req, 'id'),
    req.body,
  );

  return success(res, 200, 'Acara berhasil diperbarui', {
    data: toEventDetailDTO(event),
  });
};

export const deleteEventController = async (req: Request, res: Response) => {
  await deleteEvent(getAuthenticatedUserId(req), getParam(req, 'id'));

  return success(res, 200, 'Acara berhasil dihapus');
};

export const addEventMembersController = async (
  req: Request,
  res: Response,
) => {
  const event = await addEventMembers(
    getAuthenticatedUserId(req),
    getParam(req, 'id'),
    req.body,
  );

  return success(res, 200, 'Peserta acara berhasil ditambahkan', {
    data: toEventDetailDTO(event),
  });
};

export const removeEventMemberController = async (
  req: Request,
  res: Response,
) => {
  const userId = getAuthenticatedUserId(req);
  const targetUserId = getParam(req, 'userId');

  await removeEventMember(userId, getParam(req, 'id'), targetUserId);

  return success(
    res,
    200,
    targetUserId === userId
      ? 'Kamu berhasil keluar dari acara'
      : 'Peserta berhasil dikeluarkan dari acara',
  );
};
