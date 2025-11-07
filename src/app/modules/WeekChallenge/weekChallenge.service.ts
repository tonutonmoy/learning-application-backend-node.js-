import prisma from "../../utils/prisma";




// 2️⃣ all getAllWeek
const getAllWeek = async (userId: string) => {

  const week = await prisma.weekDay.findMany({
    where: { userId },
    orderBy: { order: 'asc' }, 
  });


  const weekCount = await prisma.weekDay.count({
    where: { userId, active: true },
  });

 
  return {
    week,      
    activeCount: weekCount, 
  };
};






//  Update challenge
const updateWeekChallenge = async (id: string) => {

  const weekDay = await prisma.weekDay.findUnique({ where: { id } });
  if (!weekDay) throw new Error("WeekDay not found");


  const updatedWeekDay = await prisma.weekDay.update({
    where: { id },
    data: { active: !weekDay.active },
  });

  return updatedWeekDay;
};


//  update week challenge automatically service
const updateWeekChallengeAutomactive = async (userId: string) => {

  const todayName = new Date().toLocaleDateString("en-US", { weekday: "long" });


  const weekDays = await prisma.weekDay.findMany({
    where: { userId },
  });

  if (!weekDays || weekDays.length === 0) {
    throw new Error("No WeekDay found for this user");
  }

    

  const updatedWeekDay = await prisma.weekDay.updateMany({
    where: { userId, name: todayName },
    data: { status: "COMPLETE",active:true }, 
  });

  return updatedWeekDay;
};


// clean challenge service
const cleanChallenge = async () => {
 
  const users = await prisma.user.findMany({
    include: { WeekDay: true },
  });

  for (const user of users) {

    const completeCount = user.WeekDay.filter(wd => wd.status === 'COMPLETE').length;


    const addCount = completeCount > 5 ? 100 : completeCount;

    await prisma.user.update({
      where: { id: user.id },
      data: { activeCount: (user.activeCount || 0) + addCount },
    });
  }


  const updatedWeekDays = await prisma.weekDay.updateMany({
    data: { status: "PENDING",active:false },
  });

  return updatedWeekDays; 
};








export const WeekChallengeService = {

  updateWeekChallenge,

  getAllWeek,
  updateWeekChallengeAutomactive,
  cleanChallenge
};
