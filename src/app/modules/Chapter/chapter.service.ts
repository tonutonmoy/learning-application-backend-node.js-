import prisma from '../../utils/prisma';


//  Create Chapter service
const createChapterIntoDB = async (payload: any) => {
 
  const chapter = await prisma.chapter.create({
    data: payload,
  });


  const existingCheckpoint = await prisma.lesson.findFirst({
    where: {
      chapterId: chapter.id,
      type: "CHECHPOINT",
      title: "Checkpoint", 
    },
  });


  if (!existingCheckpoint) {
    await prisma.lesson.create({
      data: {
        chapterId: chapter.id,
        title: "Checkpoint",
        type: "CHECHPOINT",
        content: "This is an auto-generated checkpoint lesson.",
        level: chapter.level,
        status: "ACTIVE",
        image: "", 
        order: null,
      },
    });
  }

  return chapter;
};

//  final checkpoint chapter create service
const createFinalCheckpointChapter = async () => {
 
  const existing = await prisma.chapter.findFirst({
    where: {
      title: "شهادة المستوى الأول",
      type: "FINALCHECHPOINT",
    },
    include: {
      lessons: true,
    },
  });


  if (existing) {

    return existing;
  }


  const chapter = await prisma.chapter.create({
    data: {
      title: "شهادة المستوى الأول",
      type: "FINALCHECHPOINT",
      image: "https://nyc3.digitaloceanspaces.com/smtech-space/files/0fe2a5d6-7136-4b2e-8ed4-b38dc327ddf1.png",
      status: "ACTIVE",
      lessons: {
        create: {
          title: "Final Checkpoint Lesson",
          type: "FINALCHECHPOINT",
          content: "This is the final checkpoint lesson.",
          status: "ACTIVE",
          image: "",
        },
      },
    },
    include: {
      lessons: true,
    },
  });

  
  return chapter;
};


// Get All Chapters service
const getAllChaptersFromDB = async () => {
  const chapters = await prisma.chapter.findMany({
    orderBy: {
      createdAt: 'asc', 
    },
    include: {
      lessons: {
        orderBy: {
          createdAt: 'asc',
        },
        include: { Question: true },
      },
    },
  });


  const formattedChapters = chapters.map((chapter, chapterIndex) => {
    const normalLessons = chapter.lessons.filter(ls => ls.type !== 'CHECHPOINT');
    const checkpointLessons = chapter.lessons.filter(ls => ls.type === 'CHECHPOINT');

  
    const orderedLessons = [...normalLessons, ...checkpointLessons];

    
    const lessonsWithQuestions = orderedLessons.map((lesson, lessonIndex) => {
      const questionsWithId = lesson.Question.map((q, questionIndex) => {
        const generatedId = `C${chapterIndex + 1}L${lessonIndex + 1}Q${String(
          questionIndex + 1
        ).padStart(2, "0")}`; 

        return {
          ...q,
          generatedId,
        };
      });

      return {
        ...lesson,
        Question: questionsWithId,
      };
    });

    return {
      ...chapter,
      lessons: lessonsWithQuestions,
    };
  });

  
  const normalChapters = formattedChapters.filter(ch => ch.type !== 'FINALCHECHPOINT');
  const finalChapters = formattedChapters.filter(ch => ch.type === 'FINALCHECHPOINT');

  return [...normalChapters, ...finalChapters];
};


// Completed Chapters service
const completedChapterFromDB = async (userId: string) => {
  
  const totalChapters = await prisma.chapter.count();


  const completedChaptersCount = await prisma.completeChapter.count({
    where: { userId },
  });

 
  const completedChapters = await prisma.completeChapter.findMany({
    where: { userId },
    include: { chapter: true }, 
  });

 
  const progressPercent = totalChapters === 0 ? 0 : Math.round((completedChaptersCount / totalChapters) * 100);

  return {
    totalChapters,
    completedChaptersCount,
    completedChapters,
    progressPercent, 
  };
};

// get single chapter service
const getSingleChapterFromDB = async (id: string) => {
  
  const chapters = await prisma.chapter.findMany({
    orderBy: { createdAt: "asc" },
    include: {
      lessons: { 
        orderBy: { createdAt: "asc" },
        include: { Question: true },
      },
    },
  });

  let foundChapter: any = null;

  chapters.forEach((chapter, chapterIndex) => {
    if (chapter.id === id) {
     
      const lessonsWithQuestions = chapter.lessons.map((lesson, lessonIndex) => {
        const questionsWithId = lesson.Question.map((q, questionIndex) => {
          const generatedId = `C${chapterIndex + 1}L${lessonIndex + 1}Q${String(
            questionIndex + 1
          ).padStart(2, "0")}`;
          return { ...q, generatedId };
        });

        return { ...lesson, Question: questionsWithId };
      });

      foundChapter = {
        ...chapter,
        lessons: lessonsWithQuestions,
        _count: {
          Question: chapter.lessons.reduce((sum, l) => sum + l.Question.length, 0),
        },
      };
    }
  });

  if (!foundChapter) {
    throw new Error("Chapter not found");
  }

  return foundChapter;
};

// update chapter service
const updateChapterInDB = async (id: string, payload: any) => {
  return await prisma.chapter.update({
    where: { id },
    data: payload,
  });
};


// update chapter status service
const updateChapterStatusInDB = async (id: string, status: "ACTIVE" | "INACTIVE") => {
 
  const chapter = await prisma.chapter.findFirst({
    where: { id },
    include: { lessons: true },
  });

  if (!chapter) {
    return {
      result: null,
      message: "Chapter not found!",
    };
  }

 
  if (status === "ACTIVE") {
 
    const lessonCount = await prisma.lesson.count({
      where: {
        chapterId: id,
        type: "LESSON",
      },
    });

    if (lessonCount === 0) {
      return {
        result: null,
        message: "First add a lesson  under this chapter.",
      };
    }

    const updated = await prisma.chapter.update({
      where: { id },
      data: { status: "ACTIVE" },
    });

    return {
      result: updated,
      message: "Chapter activated successfully.",
    };
  }

 
  if (status === "INACTIVE") {
    const updatedChapter = await prisma.chapter.update({
      where: { id },
      data: { status: "INACTIVE" },
    });


    await prisma.lesson.updateMany({
      where: { chapterId: id },
      data: { status: "INACTIVE" },
    });

    return {
      result: updatedChapter,
      message: "Chapter and all lessons deactivated successfully.",
    };
  }


  return {
    result: null,
    message: "Invalid status provided.",
  };
};

// delete chapter service
const deleteChapterFromDB = async (id: string) => {
 
  const lessons = await prisma.lesson.findMany({
    where: { chapterId: id },
    select: { id: true },
  });
  const lessonIds = lessons.map(lesson => lesson.id);

 
  const questions = await prisma.question.findMany({
    where: { chapterId: id },
    select: { id: true },
  });
  const questionIds = questions.map(q => q.id);


  await prisma.answer.deleteMany({
    where: { questionId: { in: questionIds } },
  });


  await prisma.savedQuestion.deleteMany({
    where: { questionId: { in: questionIds } },
  });


  await prisma.question.deleteMany({
    where: { chapterId: id },
  });

  
  await prisma.userProgress.deleteMany({
    where: { lessonId: { in: lessonIds } },
  });


  await prisma.lesson.deleteMany({
    where: { chapterId: id },
  });

  
  const deletedChapter = await prisma.chapter.delete({
    where: { id },
  });

  return deletedChapter;
};


// my checkpoint data service
const mycheckPointDtataInDB = async (userId: string, lessonId: string) => {
 

 const lesson=await prisma.lesson.findFirst({
  where:{
    id:lessonId
  },
  select:{chapterId:true}
 })


  const totalMark = await prisma.question.aggregate({
    where: {
      chapterId: lesson?.chapterId,
    },
    _sum: {
      fixedScore: true,
    },
  });


  const correctAnswers = await prisma.answer.findMany({
    where: {
      userId,
      chapterId:lesson?.chapterId,
      isCorrect: true,
    },
    include: {
      question: { select: { fixedScore: true } },
    },
  });

  
  const correctCount = await prisma.answer.count({
    where: {
      userId,
      chapterId:lesson?.chapterId,
      isCorrect: true,
    },
  });

 
  const myScore = correctAnswers.reduce((sum, ans) => {
    return sum + (ans.question?.fixedScore ?? 0);
  }, 0);

  
  const totalPoints = totalMark._sum.fixedScore ?? 0;

 
  const percentage = totalPoints > 0 ? (myScore / totalPoints) * 100 : 0;



  return {
    totalPoints,
    myScore,
    correctAnswers: correctCount,
    percentage: Number(percentage.toFixed(0)),
    stars:20,
  };
};


export const ChapterServices = {
  createChapterIntoDB,
  getAllChaptersFromDB,
  getSingleChapterFromDB,
  updateChapterInDB,
  deleteChapterFromDB,
  completedChapterFromDB,
  mycheckPointDtataInDB,
  createFinalCheckpointChapter,
  updateChapterStatusInDB
};
