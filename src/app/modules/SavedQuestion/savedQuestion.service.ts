import prisma from '../../utils/prisma';


// create saved question service
const createSavedQuestion = async (payload: any) => {
  return await prisma.savedQuestion.create({ data: payload });
};


// get all saved questions service
const getAllSavedQuestions = async () => {
  return await prisma.savedQuestion.findMany({
    include: {
      user: true,
      question: true,
    },
    orderBy: { savedAt: 'desc' },
  });
};


// get saved questions by user service
const getSavedQuestionsByUser = async (userId: string) => {
  return await prisma.savedQuestion.findMany({
    where: { userId },
    include: { question: {include:{lesson:true}}},
    orderBy: { savedAt: 'desc' },
  });
};


// delete saved question service
const deleteSavedQuestion = async (id: string) => {

  await prisma.answer.deleteMany({ where: { questionId: id } });

 
  await prisma.savedQuestion.deleteMany({ where: { questionId: id } });

 
  const deletedQuestion = await prisma.question.delete({ where: { id } });

  return deletedQuestion;
};


export const SavedQuestionServices = {
  createSavedQuestion,
  getAllSavedQuestions,
  getSavedQuestionsByUser,
  deleteSavedQuestion,
};
