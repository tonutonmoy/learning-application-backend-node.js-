import prisma from '../../utils/prisma';


//  create user progress service
const createUserProgress = async (payload: any) => {
  return await prisma.userProgress.create({ data: payload });
};


//    get all progress service
const getAllProgress = async () => {
  return await prisma.userProgress.findMany({
    include: {
      user: true,
      lesson: true,
    },
    orderBy: { date: 'desc' },
  });
};


// get progress by user service
const getProgressByUser = async (userId: string) => {
  return await prisma.userProgress.findMany({
    where: { userId },
    include: { lesson: true },
  });
};


// get progress by lesson service
const getProgressByLesson = async (lessonId: string) => {
  return await prisma.userProgress.findMany({
    where: { lessonId },
    include: { user: true },
  });
};


// update progress service
const updateProgress = async (id: string, payload: any) => {
  return await prisma.userProgress.update({
    where: { id },
    data: payload,
  });
};

export const UserProgressServices = {
  createUserProgress,
  getAllProgress,
  getProgressByUser,
  getProgressByLesson,
  updateProgress,
};
