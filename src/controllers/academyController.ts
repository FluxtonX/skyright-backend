import { Response } from 'express';
import { AuthRequest } from '../middlewares/authMiddleware';
import AcademyProgress from '../models/academyProgressModel';

const classes = [
  {
    id: 'flight-disruption-basics',
    title: 'Flight Disruption Basics',
    category: 'claims',
    durationMinutes: 12,
    level: 'Beginner',
  },
  {
    id: 'document-readiness',
    title: 'Document Readiness',
    category: 'border-ready',
    durationMinutes: 10,
    level: 'Beginner',
  },
  {
    id: 'expense-evidence',
    title: 'Expense Evidence for Claims',
    category: 'expenses',
    durationMinutes: 15,
    level: 'Intermediate',
  },
];

// @desc    List SkyRight Academy classes
// @route   GET /api/academy/classes
export const getAcademyClasses = async (req: AuthRequest, res: Response) => {
  const progress = await AcademyProgress.find({ user: req.user._id });
  const progressByClass = new Map(progress.map((item: any) => [item.classId, item]));

  res.json(classes.map((item) => ({
    ...item,
    progress: progressByClass.get(item.id)?.progress || 0,
    completed: progressByClass.get(item.id)?.completed === true,
  })));
};

// @desc    Get current user's Academy progress
// @route   GET /api/academy/progress
export const getAcademyProgress = async (req: AuthRequest, res: Response) => {
  const progress = await AcademyProgress.find({ user: req.user._id }).sort({ updatedAt: -1 });
  res.json(progress);
};

// @desc    Save class progress
// @route   PUT /api/academy/classes/:id/progress
export const updateAcademyProgress = async (req: AuthRequest, res: Response) => {
  const classInfo = classes.find((item) => item.id === req.params.id);

  if (!classInfo) {
    return res.status(404).json({ message: 'Academy class not found' });
  }

  const existing = await AcademyProgress.findOne({
    user: req.user._id,
    classId: req.params.id,
  });

  const progress = Math.max(0, Math.min(1, Number(req.body.progress ?? 0)));

  if (existing) {
    existing.progress = progress;
    existing.completed = req.body.completed === true || progress >= 1;
    existing.completedAt = existing.completed ? new Date().toISOString() : existing.completedAt || null;
    await existing.save();
    return res.json(existing);
  }

  const created = await AcademyProgress.create({
    user: req.user._id,
    userId: req.user.firebaseId,
    classId: req.params.id,
    title: classInfo.title,
    progress,
    completed: req.body.completed === true || progress >= 1,
    completedAt: req.body.completed === true || progress >= 1 ? new Date().toISOString() : null,
  });

  res.status(201).json(created);
};
