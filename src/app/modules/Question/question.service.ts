import httpStatus from 'http-status';
import AppError from '../../errors/AppError';
import prisma from '../../utils/prisma';
import Email from '../../utils/sendMail';
import QueryBuilder2 from '../../builder/QueryBuilder2';
import { formatDateTimeArabic } from '../../utils/formatDateAndTime';



interface FilterParams {
  chapterId?: string;
  lessonId?: string;
  type?: string;
  search?: string; 
  page?: number;
  limit?: number;
}


// create question service
const createQuestionIntoDB = async (payload: any) => {
  return await prisma.question.create({
    data: {
      ...payload,
      options: payload.options || [], 
    },
    include: {
      answers: true,
    },
  });
};


// create multiple question service
const createMultipleQuestiontoDB = async (payload: any[]) => {
  return await prisma.question.createMany({
    data: payload, 
  });
};


// create multiple final question service
const createMultipleFinalQuestiontoDB = async (payload: any[]) => {



  const finalCheckpoint= await prisma.chapter.findFirst({

    where:{type:"FINALCHECHPOINT"},
    select:{
id:true,lessons:{select:{id:true}}
    }
  })


  const questions = await prisma.question.findMany({
  where: {
    id: { in: payload },
  },
});


const orderedQuestions:any = payload.map(id => questions.find(q => q.id === id)).filter(Boolean);

   
  

orderedQuestions.forEach((a:any)=>
  {
     a.chapterId=finalCheckpoint?.id
     a.lessonId=finalCheckpoint?.lessons[0].id
     delete a.id

   return




   })




    const createdQuestions: any[] = [];


  for (const q of orderedQuestions) {
    const newQuestion = await prisma.question.create({
      data:q
    });

    createdQuestions.push(newQuestion);
  }

  return createdQuestions;

};

//  get filtered questions service
const getFilteredQuestions = async (params: FilterParams) => {
  const { chapterId, lessonId, type, search, page = 1, limit = 10 } = params;

  let questions: any[] = [];

  const chapters = await prisma.chapter.findMany({
    include: {
      lessons: {
        include: {
          Question: true, 
        },
      },
    },
  });

  const normalChapters = chapters.filter((c) => c.type !== "FINALCHECHPOINT");
  const finalChapters = chapters.filter((c) => c.type === "FINALCHECHPOINT");
  const orderedChapters = [...normalChapters, ...finalChapters];


  orderedChapters.forEach((chapter, chapterIndex) => {
    let lessonCounter = 0;

 
    chapter.lessons
      .filter((lesson) => lesson.type === "LESSON")
      .forEach((lesson) => {
        lessonCounter++;
        lesson.Question.forEach((q, questionIndex) => {
          const generatedId = `C${chapterIndex + 1}L${lessonCounter}Q${String(
            questionIndex + 1
          ).padStart(2, "0")}`;

          questions.push({
            ...q,
            generatedId,
            chapterId: chapter.id,
            lessonId: lesson.id,
            lesson: { title: lesson.title },
            chapter: { title: chapter.title },
          });
        });
      });

 
    chapter.lessons
      .filter((lesson) => lesson.type === "CHECHPOINT")
      .forEach((lesson) => {
        lesson.Question.forEach((q, questionIndex) => {
          const generatedId = `C${chapterIndex + 1}CHK${String(
            questionIndex + 1
          ).padStart(2, "0")}`;

          questions.push({
            ...q,
            generatedId,
            chapterId: chapter.id,
            lessonId: lesson.id,
            lesson: { title: lesson.title },
            chapter: { title: chapter.title },
          });
        });
      });

   
    chapter.lessons
      .filter((lesson) => lesson.type === "FINALCHECHPOINT")
      .forEach((lesson) => {
        lesson.Question.forEach((q, questionIndex) => {
          const generatedId = `C${chapterIndex + 1}FCHK${String(
            questionIndex + 1
          ).padStart(2, "0")}`;

          questions.push({
            ...q,
            generatedId,
            chapterId: chapter.id,
            lessonId: lesson.id,
            lesson: { title: lesson.title },
            chapter: { title: chapter.title },
          });
        });
      });
  });


  if (lessonId) questions = questions.filter((q) => q.lessonId === lessonId);
  else if (chapterId) questions = questions.filter((q) => q.chapterId === chapterId);

  if (type) questions = questions.filter((q) => q.type === type);

  if (search) {
    const s = search.toLowerCase();
    questions = questions.filter(
      (q) => q.title.toLowerCase().includes(s) || q.generatedId.toLowerCase() === s
    );
  }

  const total = questions.length;
  const start = (page - 1) * limit;
  const end = start + limit;
  const paginated = questions.slice(start, end);

  return {
    meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    data: paginated,
  };
};


// get all questions with query service
const getAllQuestionsFromDBWithQuery = async (query: Record<string, unknown>) => {
  const questionQuery = new QueryBuilder2<typeof prisma.question>(prisma.question, query);
  const result = await questionQuery
    .search(['title', 'explanation', 'suggestion'])
    .filter()
    .sort()
    .customFields({
      id: true,
      title: true,
      type: true,
      chapter: {
        select: {
          id: true,
          title: true
        }
      },
      lesson: {
        select: {
          id: true,
          title: true
        }
      },
      suggestion: true,
      explanation: true
    })
    .exclude()
    .paginate()
    .execute();

  return result;
}


// save question service
const saveQuestionIntoDB = async (userId: string, questionId: string) => {
  const reportQuestion = await prisma.question.findFirst({ where: { id: questionId } })

  if (!reportQuestion) {
    throw new AppError(httpStatus.NOT_FOUND, 'Question not found!');
  }

  const existing = await prisma.savedQuestion.findFirst({
    where: {
      userId,
      questionId,
    },
  });

  if (existing) {
 
    await prisma.savedQuestion.delete({
      where: { id: existing.id },
    });

    return { message: "Question unsaved successfully", saved: false };
  } else {
 
    await prisma.savedQuestion.create({
      data: {
        userId,
        questionId,
      },
    });

    return { message: "Question saved successfully", saved: true };
  }
};

// get saved questions service
const getSaveQuestionsFromDB = async (userId: string) => {
   const result= await prisma.savedQuestion.findMany({
    where: { userId },
    include: { question: { include: { lesson: true } } }


  });


  result.forEach((element:any) => {
      element.question.lessonImage=  element?.question?.lesson?.image
  });

  return result
};

// get single question service
const getSingleQuestionFromDB = async (id: string) => {
  
  const chapters = await prisma.chapter.findMany({
    orderBy: { createdAt: "asc" },
    include: {
      lessons: {
        orderBy: { createdAt: "asc" },
        include: {
          Question: {
            orderBy: { createdAt: "asc" },
          },
        },
      },
    },
  });


  let foundQuestion: any = null;

  chapters.forEach((chapter, chapterIndex) => {
    chapter.lessons.forEach((lesson, lessonIndex) => {
      lesson.Question.forEach((q, questionIndex) => {
        if (q.id === id) {
          const generatedId = `C${chapterIndex + 1}L${lessonIndex + 1}Q${String(
            questionIndex + 1
          ).padStart(2, "0")}`;

          foundQuestion = {
            ...q,
            generatedId,
          };
        }
      });
    });
  });

  if (!foundQuestion) {
    throw new Error("Question not found");
  }

  return foundQuestion;
};

// update question service
const updateQuestionInDB = async (id: string, payload: any) => {
  return await prisma.question.update({
    where: { id },
    data: {
      ...payload,
      options: payload.options || [],
    },
    include: {
      answers: true,
    },
  });
};


// delete question service
const deleteQuestionFromDB = async (id: string) => {

  await prisma.answer.deleteMany({ where: { questionId: id } });


  await prisma.savedQuestion.deleteMany({ where: { questionId: id } });


  const deletedQuestion = await prisma.question.delete({ where: { id } });

  return deletedQuestion;
};


// report question service
const reportQuestionIntoDB = async (
  userId: string,
  document: string,
  userEmail: string,
  details: string
) => {

  const report = await prisma.reportQuestion.create({
    data: {
      user: { connect: { id: userId } },
      document, 
      email: userEmail,
      details,
    },
    include: {
      user: { select: { email: true, userName: true } },
    },
  });


  const adminUser = {
    email: process.env.Mail || "contact@reciteone.com",
    firstName: "Najwa",
  } as any;

  const email = new Email(adminUser);

  const subject = `اتصل بنا`;

  const message =  `
  <div dir="rtl" style="font-family: Arial, Helvetica, sans-serif; color: #333;">
    <h2 style="text-align:right;">تم استلام رسالتك</h2>
    <table style="width:100%; border-collapse: collapse; margin-top: 15px;">
      <tr>
        <td style="text-align:right;"><b>البريد الإلكتروني: </b>${userEmail}</td>
      </tr>
     ${report.document?`<tr>
        <td style="text-align:right;"><b>الملف: </b> <a href="${report?.document}" target="_blank">تحميل</a></td>
      </tr>`:""}
      <tr>
        <td style="text-align:right;"><b>التفاصيل: </b> ${report?.details ?? "N/A"}</td>
      </tr>
    </table>
    <p style="font-size:12px; color:#888; margin-top:15px; text-align:right;">تمَّ الإرسال في ${formatDateTimeArabic(report?.createdAt)}</p>
  </div>`;


  message
  
  

  await email.sendCustomEmail(subject, message);

  return report;
};

//  get reported questions service
const getReportedQuestionsFromDB = async () => {
  return await prisma.reportQuestion.findMany({
  });
};




export const QuestionServices = {
  createQuestionIntoDB,

  getSingleQuestionFromDB,
  updateQuestionInDB,
  deleteQuestionFromDB,
  saveQuestionIntoDB,
  getSaveQuestionsFromDB,
  reportQuestionIntoDB,
  getReportedQuestionsFromDB,
  createMultipleQuestiontoDB,
  createMultipleFinalQuestiontoDB,
  getAllQuestionsFromDBWithQuery,
  // searchQuestionsFromDB,
  getFilteredQuestions

};
