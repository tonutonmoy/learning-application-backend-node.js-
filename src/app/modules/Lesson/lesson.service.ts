import prisma from '../../utils/prisma';
import { firebasePushNotificationServices } from '../Firebase/firebasePushNotificationServices';



// Create Lesson service
const createLessonIntoDB = async (payload: any) => {
  return await prisma.lesson.create({
    data: payload,
  });
};

// Get All Lessons service
const getAllLessonsFromDB = async () => {
 
  const chapters = await prisma.chapter.findMany({
    orderBy: { createdAt: 'asc' },
    include: {
      lessons: {
        orderBy: { createdAt: 'asc' },
        include: { Question: true },
      },
    },
  });

  
  let lessonsWithQuestions: any[] = [];

  chapters.forEach((chapter, chapterIndex) => {
    chapter.lessons.forEach((lesson, lessonIndex) => {
      const questionsWithId = lesson.Question.map((q, questionIndex) => {
        const generatedId = `C${chapterIndex + 1}L${lessonIndex + 1}Q${String(
          questionIndex + 1,
        ).padStart(2, '0')}`;

        return {
          ...q,
          generatedId,
        };
      });

      lessonsWithQuestions.push({
        ...lesson,
        chapter,
        Question: questionsWithId,
      });
    });
  });

  return lessonsWithQuestions;
};


// Get Single Lesson service
const getSingleLessonFromDB = async (id: string) => {
 
  const chapters = await prisma.chapter.findMany({
    orderBy: { createdAt: 'asc' },
    include: {
      lessons: {
        orderBy: { createdAt: 'asc' },
        include: { Question: true },
      },
    },
  });

  let foundLesson: any = null;

  chapters.forEach((chapter, chapterIndex) => {
    chapter.lessons.forEach((lesson, lessonIndex) => {
      if (lesson.id === id) {
      
        const questionsWithId = lesson.Question.map((q, questionIndex) => {
          const generatedId = `C${chapterIndex + 1}L${lessonIndex + 1}Q${String(
            questionIndex + 1,
          ).padStart(2, '0')}`;

          return {
            ...q,
            generatedId,
          };
        });

        foundLesson = {
          ...lesson,
          Question: questionsWithId,
          chapter,
        };
      }
    });
  });

  if (!foundLesson) {
    throw new Error('Lesson not found');
  }

  return foundLesson;
};


// Update Lesson service
const updateLessonInDB = async (id: string, payload: any) => {
  return await prisma.lesson.update({
    where: { id },
    data: payload,
  });
};


// Update Lesson Status service
const updateLessonStatusInDB = async (
  id: string,
  status: 'ACTIVE' | 'INACTIVE',
) => {
  const lesson = await prisma.lesson.findUnique({
    where: { id },
    include: { chapter: true },
  });

  if (!lesson) {
    return {
      result: null,
      message: 'Lesson not found!',
    };
  }

  // যদি ACTIVE করতে চাই
  if (status === 'ACTIVE') {
    // Chapter inactive হলে lesson কে active করা যাবে না
    if (lesson.chapter.status !== 'ACTIVE') {
      return {
        result: null,
        message: 'Lesson cannot be activated because its chapter is inactive.',
      };
    }

    // 🔹 Check করতে হবে এই lesson এর under কোনো question আছে কিনা
    const questionCount = await prisma.question.count({
      where: { lessonId: id },
    });

    if (questionCount === 0) {
      return {
        result: null,
        message:
          'Lesson cannot be activated because no question is added under it.',
      };
    }

    const updated = await prisma.lesson.update({
      where: { id },
      data: { status: 'ACTIVE' },
    });

    return {
      result: updated,
      message: 'Lesson activated successfully.',
    };
  }

  // যদি INACTIVE করতে চাই
  if (status === 'INACTIVE') {
    const updated = await prisma.lesson.update({
      where: { id },
      data: { status: 'INACTIVE' },
    });

    return {
      result: updated,
      message: 'Lesson deactivated successfully.',
    };
  }

  return {
    result: null,
    message: 'Invalid status provided.',
  };
};


// Delete Lesson service
const deleteLessonFromDB = async (id: string) => {
 
  
  const lesson = await prisma.lesson.findUnique({
    where: { id },
  });

  if (!lesson) {
    throw new Error('Lesson not found');
  }

  await prisma.answer.deleteMany({
    where: {
      question: {
        lessonId: lesson.id,
      },
    },
  });


  await prisma.savedQuestion.deleteMany({
    where: {
      question: { lessonId: lesson.id },
    },
  });

 
  await prisma.userProgress.deleteMany({
    where: { lessonId: id },
  });


  const deleted = await prisma.lesson.delete({
    where: { id },
  });

  return deleted;
};


// my checkpoint data service
const mycheckPointDtataInDB = async (userId: string, lessonId: string,type:any) => {
         
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, fcmToken: true, email: true,daailyGoalNotification:true },
    });




 

  const answers = await prisma.answer.findMany({
    where: {
       question:{
          lessonId
       }, 
      userId,
    },
    select: {
      isCorrect: true,
      question: {
        select: { fixedScore: true },
      },
    },
  });

  


  const totalQuestions = answers.length;


  const totalScore = answers.reduce((sum, ans) => sum + (ans.question?.fixedScore || 0), 0);

  
  const correctAnswers = answers.filter((ans) => ans.isCorrect).length;

 
  const correctScore = answers
    .filter((ans) => ans.isCorrect)
    .reduce((sum, ans) => sum + (ans.question?.fixedScore || 0), 0);


  const percentage = totalScore
    ? Math.round((correctScore / totalScore) * 100)
    : 0;

 
  const lesson = await prisma.lesson.findFirst({
    where: { id: lessonId },
  });

 
  const stars = percentage === 100 ? 8 : 5;


 const allChapter = await prisma.chapter.findMany({
  where: {
    type: "CHAPTER"
  },
  include: {
    lessons: true
  },
  orderBy: {
    createdAt: 'asc' 
  }
});


const lastChapter = allChapter[allChapter.length - 1];


const checkpointLesson = lastChapter.lessons.find(
  (lesson) => lesson.type==="CHECHPOINT"
);


const checkpointLessonId = checkpointLesson ? checkpointLesson.id : null;


if(checkpointLessonId===lessonId){

 
  const allChaptersFinishedNotifications = [
    `ما شاء الله! أنهيت 5 فصول — حان وقت الاختبار لتحصد ثمرة جهدك. 🏅`,
    `لقد وصلت إلى مرحلة متقدمة — ادخل الاختبار وأثبت إتقانك. 🌟`,
    `أنهيت 5 فصول — اجتز الاختبار ونل شهادة لمسيرتك المباركة. 📜`,
    `لا تتوقف هنا! الاختبار هو بوابتك لشهادة الإتقان. 🚀`,
    `تعبك لن يضيع — اجتز الاختبار ونل شهادة التميز. 🎓`,
  ];


  const randomNotification =
    allChaptersFinishedNotifications[
      Math.floor(Math.random() * allChaptersFinishedNotifications.length)
    ];

if(!type){
    try {


    if (user?.daailyGoalNotification===true && user.fcmToken) {
      await firebasePushNotificationServices.sendSinglePushNotification({
       
        body: {
          title: "إنجازٌ كبير🎯",
          body: randomNotification,
        },
        fcmToken: user.fcmToken,
      });

     
    } else {
    
    }
  } catch (err) {
    console.error(
      `❌ Error sending final checkpoint notification to user ${userId}:`,
      err
    );
  }
}

}

const CheckpointPassed=[
 `تقدُّم رائع في محطة التقييم 🌟 زادك الله رفعةً وهمةً🎉`,
 `ما شاء الله عليك، إنجاز جديد يُضاف لرصيدك 🌟`,
 `اجتزت محطة التقييم! استمر نحو القمة 🚀`,
 `ما شاء الله، كل محطة تقرّبك أكثر من التميز 🌟`,
 `الحمد لله! لقد اجتزت محطة التقييم بنجاح 🏅`


]

const CheckpointFailed=[
  `جهد محمود! راجع دروسك السابقة وأعد المحاولة 🌟`,
  `لا تقلق، محطة التقييم فرصة للتعلّم أكثر ✨`,
  `كل محاولة تقرّبك من الإتقان 💪`,
  `لم تتجاوز محطة التقييم هذه المرة، لكنك أقرب من أي وقت مضى 🎯`,
  `اجعل اجتياز محطة التقييم هدفك القادم، وستصل بإذن الله 🌟`
]





if(!type){
  if (  user?.fcmToken&&percentage >= 75 && lesson?.type==="CHECHPOINT") {

  const randomMsg =
    CheckpointPassed[Math.floor(Math.random() * CheckpointPassed.length)];

if(user.daailyGoalNotification===true){
    await firebasePushNotificationServices.sendSinglePushNotification({
   
    body: { title: "محطّة التقييم🎯", body: randomMsg },
    fcmToken: user?.fcmToken,
  });
}

 
} 

}

if(!type){
  if(user?.fcmToken&&percentage < 75&&lesson?.type==="CHECHPOINT") {
 
  const randomMsg =
    CheckpointFailed[Math.floor(Math.random() * CheckpointFailed.length)];
if(user.daailyGoalNotification===true){
  await firebasePushNotificationServices.sendSinglePushNotification({
   
    body: { title: "محطّة التقييم 🔄", body: randomMsg },
    fcmToken: user?.fcmToken,
  });}

}

}

  return {
    lessonId,
    totalQuestion: totalQuestions,
    correctAnswers,
    percentage,
    stars: lesson?.type === "LESSON" ? stars : 20,
  };
};


// final checkpoint data service
const finalcheckPointDtataInDB = async (userId: string) => {

  const totalMark = await prisma.question.aggregate({
    _sum: { fixedScore: true },
  });


  const correctAnswers = await prisma.answer.findMany({
    where: {
      userId,
      isCorrect: true,
    },
    include: {
      question: { select: { fixedScore: true } },
    },
  });


  const correctCount = correctAnswers.length;


  const myScore = correctAnswers.reduce((sum, ans) => {
    return sum + (ans.question?.fixedScore ?? 0);
  }, 0);

 
  const totalPoints = totalMark._sum.fixedScore ?? 0;


  const percentage = totalPoints > 0 ? (myScore / totalPoints) * 100 : 0;

 
  const stars = Math.floor(percentage / 10);

  return {
    totalPoints,
    myScore,
    correctAnswers: correctCount,
    percentage: Number(percentage.toFixed(0)),
    stars: stars,
  };
};

// get lesson correct percentage
export const getLessonCorrectPercentage = async (userId: string, lessonId: string): Promise<number> => {

  const questionsCount = await prisma.question.count({
    where: { lessonId },
  });

  if (questionsCount === 0) return 0;

  const correctAnswersCount = await prisma.answer.count({
    where: {
      userId,
      isCorrect: true,
      question: { lessonId },
    },
  });


  const correctPercentage = Math.round((correctAnswersCount / questionsCount) * 100);

  return correctPercentage || 0;
};



export const LessonServices = {
  createLessonIntoDB,
  getAllLessonsFromDB,
  getSingleLessonFromDB,
  updateLessonInDB,
  deleteLessonFromDB,
  mycheckPointDtataInDB,
  updateLessonStatusInDB,
  finalcheckPointDtataInDB,
};
// 