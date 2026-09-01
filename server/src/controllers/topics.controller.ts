import type { Request, Response } from 'express';

import { Topic } from '../models/Topic';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../utils/ApiError';

export const listTopics = asyncHandler(async (_req: Request, res: Response) => {
  const topics = await Topic.find().sort({ name: 1 }).lean();

  const data = topics.map((t) => ({
    id: String(t._id),
    name: t.name,
    description: t.description,
    parentTopic: t.parentTopic ? String(t.parentTopic) : null,
    isActive: t.isActive,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
  }));

  res.json({ success: true, data });
});

export const getTopicTree = asyncHandler(async (_req: Request, res: Response) => {
  const topics = await Topic.find({ isActive: true }).lean();

  const roots: any[] = [];

  const nodeMap = new Map<string, any>();
  for (const t of topics) {
    nodeMap.set(String(t._id), {
      id: String(t._id),
      name: t.name,
      description: t.description,
      children: [],
    });
  }

  for (const t of topics) {
    const node = nodeMap.get(String(t._id))!;
    if (t.parentTopic && nodeMap.has(String(t.parentTopic))) {
      nodeMap.get(String(t.parentTopic))!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  res.json({ success: true, data: roots });
});

export const getTopic = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const topic = await Topic.findById(id).lean();
  if (!topic) throw new AppError('Topic not found', 404, 'NOT_FOUND');

  const children = await Topic.find({ parentTopic: topic._id }).lean();

  res.json({
    success: true,
    data: {
      id: String(topic._id),
      name: topic.name,
      description: topic.description,
      parentTopic: topic.parentTopic ? String(topic.parentTopic) : null,
      isActive: topic.isActive,
      children: children.map((c) => ({
        id: String(c._id),
        name: c.name,
        isActive: c.isActive,
      })),
    },
  });
});

export const createTopic = asyncHandler(async (req: Request, res: Response) => {
  const { name, description, parentTopic } = req.body as {
    name: string;
    description?: string;
    parentTopic?: string | null;
  };

  const existing = await Topic.findOne({ name: name.trim() }).lean();
  if (existing) throw new AppError('Topic already exists', 409, 'CONFLICT');

  let parentId: string | null = null;
  if (parentTopic) {
    const parent = await Topic.findById(parentTopic).lean();
    if (!parent) throw new AppError('Parent topic not found', 400, 'VALIDATION_ERROR');
    parentId = parentTopic;
  }

  const topic = await Topic.create({
    name: name.trim(),
    description: description?.trim() ?? '',
    parentTopic: parentId ?? undefined,
    isActive: true,
  });

  res.status(201).json({ success: true, data: { id: String(topic._id) } });
});

export const updateTopic = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, description, parentTopic, isActive } = req.body as {
    name?: string;
    description?: string;
    parentTopic?: string | null;
    isActive?: boolean;
  };

  const topic = await Topic.findById(id);
  if (!topic) throw new AppError('Topic not found', 404, 'NOT_FOUND');

  if (name !== undefined) {
    if (name.trim() !== topic.name) {
      const existing = await Topic.findOne({ name: name.trim() }).lean();
      if (existing) throw new AppError('Topic name already exists', 409, 'CONFLICT');
    }
    topic.name = name.trim();
  }
  if (description !== undefined) topic.description = description.trim();
  if (parentTopic !== undefined) topic.parentTopic = (parentTopic ?? null) as any;
  if (isActive !== undefined) topic.isActive = isActive;

  await topic.save();
  res.json({ success: true, data: { id: String(topic._id) } });
});

export const deleteTopic = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const topic = await Topic.findById(id);
  if (!topic) throw new AppError('Topic not found', 404, 'NOT_FOUND');

  const children = await Topic.countDocuments({ parentTopic: topic._id });
  if (children > 0) {
    throw new AppError(
      'Cannot deactivate topic with subtopics. Deactivate subtopics first.',
      409,
      'CONFLICT'
    );
  }

  topic.isActive = false;
  await topic.save();
  res.json({ success: true, message: 'Topic deactivated' });
});
