// ---------------- Answer validation & save ----------------

import httpStatus from 'http-status';
import AppError from '../../errors/AppError';
import prisma from '../../utils/prisma';
import { getLessonCorrectPercentage } from '../Lesson/lesson.service';



function deepEqual(a: any, b: any): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (a === null || b === null) return false;

  if (Array.isArray(a)) {
    if (!Array.isArray(b) || a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!deepEqual(a[i], b[i])) return false;
    }
    return true;
  }

  if (typeof a === 'object') {
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    if (keysA.length !== keysB.length) return false;
    for (const key of keysA) {
      if (!deepEqual(a[key], b[key])) return false;
    }
    return true;
  }

  return false;
}

// ✅ Array of objects comparison (order independent)
function arrayOfObjectsMatch(userAnswer: any[], correctAnswer: any[]): boolean {
  if (!Array.isArray(userAnswer) || !Array.isArray(correctAnswer)) return false;
  if (userAnswer.length !== correctAnswer.length) return false;

  // check each userAnswer object exists in correctAnswer array
  return userAnswer.every(uObj =>
    correctAnswer.some(cObj => deepEqual(uObj, cObj)),
  );
}

// submit answer service
const submitAnswerIntoDB = async ({
  questionId,
  userId,
  userAnswer,
}: {
  questionId: string;
  userId: string;
  userAnswer: any;
}) => {
  // 0️⃣ Fetch user
  const user = await prisma.user.findUnique({ where: { id: userId } });

 

  if (!user) throw new AppError(httpStatus.NOT_FOUND, 'User not found');


  // 2️⃣ Question fetch
  const question: any = await prisma.question.findUnique({
    where: { id: questionId },
    include: {
      lesson: {
        select: {
          id: true,
          type: true,
          chapter: { select: { id: true } },
        },
      },
    },
  });
  if (!question) throw new Error('Question not found');


  // 3️⃣ Validate answer
  let isCorrect = false;
  let finalUserAnswer: any = userAnswer;

  const normalize = (str: string) => str.toLowerCase().replace(/\s+/g, '');

  switch (question.type) {
    case 'MULTIPLE_CHOICE':
      isCorrect = normalize(question.answer) === normalize(userAnswer);
    case 'TRUE_FALSE':
      isCorrect = question.answer === userAnswer;
      break;
    case 'PUT_IN_ORDER':
      
      isCorrect = true;
      finalUserAnswer = question.suggestion || question.explanation;
      break;
    case 'MATCH_PAIRS':
      isCorrect = arrayOfObjectsMatch(userAnswer, question.answer);
      break;
    case 'FLIPCARD':
      isCorrect = true;
      break;
    default:
      throw new Error('Unknown question type');
  }

  // 4️⃣ Check if already answered → Update / Create
  let savedAnswer;
  const alreadyAnswered = await prisma.answer.findFirst({
    where: { questionId, userId },
  });

  if (alreadyAnswered) {
    savedAnswer = await prisma.answer.update({
      where: { id: alreadyAnswered.id },
      data: {
        isCorrect,
        userAnswer: finalUserAnswer,
      },
    });

   
  } else {
    savedAnswer = await prisma.answer.create({
      data: {
        questionId,
        userId,
        isCorrect,
        chapterId: question.lesson.chapter.id,
        userAnswer: finalUserAnswer,
      },
    });
  }

  // 5️⃣ Update user progress
  const existingProgress = await prisma.userProgress.findFirst({
    where: { userId, lessonId: question.lesson.id },
  });

  if (existingProgress) {
    await prisma.userProgress.update({
      where: { id: existingProgress.id },
      data: {
        score: { increment: isCorrect ? question.fixedScore : 0 },
        completed: true,
      },
    });
  } else {
    await prisma.userProgress.create({
      data: {
        userId,
        lessonId: question.lesson.id,
        score: isCorrect ? question.fixedScore : 0,
        completed: true,
      },
    });
  }

  // 6️⃣ Extra Feature: Check if FINAL CHECKPOINT
  let percentage: any;

  if (question.lesson.type === 'FINALCHECHPOINT') {
    const allQuestions = await prisma.question.findMany({
      where: { lessonId: question.lesson.id },
      select: { id: true },
    });

    

    const totalQ = allQuestions.length;

    const answered = await prisma.answer.findMany({
      where: { userId, questionId: { in: allQuestions.map(q => q.id) } },
    });

    

    const correctCount = answered.filter(a => a.isCorrect).length;

    // percentage 

      percentage= await getLessonCorrectPercentage(userId,question.lessonId)

      
    console.log(percentage)
    
    // unblock user if final checkpoint is passed
    if (percentage >= 85 && user.blockForWeek) {
      await prisma.user.update({
        where: { id: userId },
        data: { blockForWeek: false, blockForWeekTime: null },
      });
    }

    await prisma.userProgress.updateMany({
      where: { userId, lessonId: question.lesson.id },
      data: { completelyWithPercentage: true, lessonCount: 100 },
    });
  }



const filnalCheckPointData = await prisma.chapter.findFirst({
  where: {
    type: "FINALCHECHPOINT",
  },
  include: {
    lessons: {
      include: {
        Question: true,
      },
    },
  },
  orderBy: {
    createdAt: 'desc', 
  },
});

const lastLesson = filnalCheckPointData?.lessons[filnalCheckPointData?.lessons.length - 1];
const lastQuestion = lastLesson?.Question[lastLesson?.Question.length - 1];





if(lastQuestion?.id===questionId){


  await prisma.user.update({
    where:{
id:userId
    },
    data:{
      isFinalCheckPointCompleted:true
    }
  })


  
}





  
  return {
    success: true,
    isCorrect,
    correctAnswer:
      question.answer || question.suggestion || question.explanation,
    savedAnswerId: savedAnswer.id,
    message: isCorrect ? 'Correct answer!' : 'Incorrect answer',
    ...(percentage !== null && { finalCheckpointPercentage: percentage }),
  };
};

// my correct answers service
const myCorrectAnswerIntoDB = async (id: string) => {
  const result = await prisma.answer.findMany({
    where: { userId: id },
  });
  const correctAnswer = await prisma.answer.count({
    where: { userId: id, isCorrect: true },
  });
  

  return {
    data: result,
    correctAnswer,
  };
};

// my all answers service
const myAllAnswerIntoDB = async (id: string) => {
  const result = await prisma.answer.findMany({
    where: { userId: id },
  });

  return result;
};


// my review answers service
const myReviewIntoDB = async (id: string) => {
  const result = await prisma.answer.findMany({
    where: {
      userId: id,
      isCorrect: false,
      NOT: {
        questionId: null, // ✅ works type-safely
      },
    },
    include: {
      question: {
        include: { lesson: true },
      },
    },
  });

  return result.map((r: any) => ({
    ...r,
    question: r.question
      ? {
          ...r.question,
          lessonImage: r?.question?.lesson?.image || '',
        }
      : null,
  }));
};




// submit or update answer service
const submitOrUpdateAnswerIntoDB = async ({
  answerId,
  userId,
  userAnswer,
}: {
  answerId: string;
  userId: string;
  userAnswer: any;
}) => {
  // 1️⃣ Answer fetch (with Question info)
  const existingAnswer = await prisma.answer.findUnique({
    where: { id: answerId },
    include: {
      question: {
        include: {
          lesson: { select: { chapter: { select: { id: true } } } },
        },
      },
    },
  });

  if (!existingAnswer) {
    throw new Error('Answer not found!');
  }


  if (existingAnswer.userId !== userId) {
    throw new Error('You are not allowed to update this answer!');
  }

  const question: any = existingAnswer.question;

  // 2️⃣ Validate answer
  let isCorrect = false;

  switch (question.type) {
    case 'MULTIPLE_CHOICE':
    case 'TRUE_FALSE':
      isCorrect = question.answer === userAnswer;
      break;

    case 'PUT_IN_ORDER':
      isCorrect = question.answer === userAnswer;
      break;

    case 'MATCH_PAIRS':
      isCorrect = arrayOfObjectsMatch(userAnswer, question.answer);
      break;

    case 'FLIPCARD':
      isCorrect = true; // optional
      break;

    default:
      throw new Error('Unknown question type');
  }

  // Update existing answer
  const updatedAnswer = await prisma.answer.update({
    where: { id: answerId },
    data: {
      isCorrect,
      userAnswer,
    },
  });

  // Update user progress
  const existingProgress = await prisma.userProgress.findFirst({
    where: { userId, lessonId: question.lessonId },
  });

  if (existingProgress) {
    await prisma.userProgress.update({
      where: { id: existingProgress.id },
      data: {
        score: {
          increment: isCorrect ? question.fixedScore : 0,
        },
        completed: true,
      },
    });
  } else {
    await prisma.userProgress.create({
      data: {
        userId,
        lessonId: question.lessonId,
        score: isCorrect ? question.fixedScore : 0,
        completed: true,
      },
    });
  }


  return {
    success: true,
    isCorrect,
    correctAnswer: question.answer,
    savedAnswerId: updatedAnswer.id,
    message: isCorrect
      ? 'Answer updated & correct!'
      : 'Answer updated but incorrect!',
  };
};

export const AnswerServices = {
  submitAnswerIntoDB,
  myCorrectAnswerIntoDB,
  myAllAnswerIntoDB,
  myReviewIntoDB,
  submitOrUpdateAnswerIntoDB,
};
