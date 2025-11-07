import cors from 'cors';
import express, { Application, NextFunction, Request, Response } from 'express';
import cron from 'node-cron';
import path from 'path';
import globalErrorHandler from './app/middlewares/globalErrorHandler';
import { firebasePushNotificationServices } from './app/modules/Firebase/firebasePushNotificationServices';
import { UserServices } from './app/modules/User/user.service';
import { WeekChallengeService } from './app/modules/WeekChallenge/weekChallenge.service';
import router from './app/routes';
import prisma from './app/utils/prisma';
import Email from './app/utils/sendMail';
import moment from 'moment-timezone';



export {};

declare global {
  var isDailyQuoteJobRunning: boolean | undefined;
}


const app: Application = express();
app.use(
  cors({
    origin: [
      'http://localhost:3001',
      'http://localhost:3000',
      'http://204.197.173.249:3888',
      'http://204.197.173.249:3889',
      'http://72.60.83.59:5000',
      'http://72.60.83.59:3000',
      
    ],
    credentials: true,
  }),
);



//parser
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/', async (req: Request, res: Response) => {
  res.json({
    message: 'Server ruining ok',
  });
});

app.use('/api/v1', router);
app.use('/fonts', express.static(path.join(__dirname, '..', 'public/fonts')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use(globalErrorHandler);

app.use(async (req: Request, res: Response, next: NextFunction) => {


  res.json({
    message: 'APi not found',
  });
});






// Generating daily challenges strat ----------------------------------------------- Done
cron.schedule('* * * * *', async () => {
  console.log('⏰ Generating daily challenges...');
  await UserServices.generateDailyChallenges();
});
// Generating daily challenges end---------------------------------------------- Done



// clean week   strat ----------------------------------------------- Done
cron.schedule('59 23 * * 0', async () => {
  console.log('⏰ Generating weekly challenge cleanup (Sunday 11:59 PM Morocco time)...');

  // Convert current time to Morocco time for clarity/logging
  const moroccoTime = moment().tz('Africa/Casablanca').format('YYYY-MM-DD HH:mm:ss');
  console.log(`🇲🇦 Current Morocco Time: ${moroccoTime}`);

  await WeekChallengeService.cleanChallenge();
});
// clean week   end ----------------------------------------------- Done












// -----------------------------   main   -------------------------------------- Done

cron.schedule('* * * * *', async () => {
  console.log('⏰ Running daily goal notification cron job...');
// hello
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999);
    
  try {
    const users = await prisma.user.findMany({
      where: {
        dailyGoal: { gt: 0 },    
        // daailyGoalNotification: true,
        fcmToken: { not: null },
      },
      include: { WeekDay: true },
    });

    await Promise.all(
      users.map(async (user: any) => {
        const todayName = new Date().toLocaleDateString('en-US', { weekday: 'long' });
        const hasTodayChallenge = user.WeekDay.some((ch: any) => ch.name === todayName);
        if (!hasTodayChallenge || !user.readStart) return;

        const start = new Date(user.readStart);
        const end = user.readEnd ? new Date(user.readEnd) : null;
        const isActiveNow = end && start.getTime() === end.getTime();
        const diffMinutes =
          end && !isActiveNow
            ? Math.floor((end.getTime() - start.getTime()) / 60000)
            : Math.floor((Date.now() - start.getTime()) / 60000);
        const targetMinutes = user.dailyGoal || 0;

        //  SENT notification already check
        const sentNotification = await prisma.pushNotification.findFirst({
          where: {
            userId: user.id,
            date: { gte: startOfDay, lte: endOfDay },
            status: 'SENT',
          },
        });
        if (sentNotification) {
          console.log(`⏩ ${user.email} already got SENT notification today.`);
          await prisma.user.update({
            where: { id: user.id },
            data: { readStart: null, readEnd: null },
          });
          return;
        }

        let newMessage = '';
        let newTitle = '';
        let newStatus: 'SENT' | 'PENDING' = 'PENDING';
        let isCompleted = false;

        if (diffMinutes >= targetMinutes) {
          newMessage = `عمل رائع! لقد أكملت هدفك اليوم البالغ ${targetMinutes} دقيقة. 🎉`;
          newTitle = 'إنجازُ اليوم🎯';
          newStatus = 'SENT';
          isCompleted = true;
        } 

        //  Notification create or update
        let notification = await prisma.pushNotification.findFirst({
          where: {
            userId: user.id,
            date: { gte: startOfDay, lte: endOfDay },
          },
        });

        if (!notification) {
          notification = await prisma.pushNotification.create({
            data: {
              userId: user.id,
              title: newTitle,
              message: newMessage,
              status: newStatus,
              isCompleted,
              date: startOfDay,
            },
          });
        } else if (
          notification.message !== newMessage ||
          notification.status !== newStatus ||
          notification.isCompleted !== isCompleted
        ) {
          notification = await prisma.pushNotification.update({
            where: { id: notification.id },
            data: {
              title: newTitle,
              message: newMessage,
              status: newStatus,
              isCompleted,
              updatedAt: new Date(),
            },
          });
        }

        //  Push Notification 
        try {
          if(user?.daailyGoalNotification===true){
              
                 await firebasePushNotificationServices.sendSinglePushNotification({
            
            body: { title: newTitle, body: newMessage },
            fcmToken: user?.fcmToken,
          });

           
        }

         if (isCompleted) {
                 
          await prisma.user.update({
            where: { id: user.id },
            data: { readStart: null, readEnd: null },
          });


          // Optional: weekly challenge update
          
            const  result= await WeekChallengeService.updateWeekChallengeAutomactive(user.id);


       

            if(result){
              sendGoalCompletionNotification(user.id)
            
            }
             
          }
         
          console.log(
            `${isCompleted ? '🎉 Goal complete' : '📩 Progress'} push sent to ${user.email}`
          );
        } catch (err) {
          console.error('❌ Push send failed:', err);
        }


    
      })
    );
  } catch (error) {
    console.error('❌ Cron job failed:', error);
  }
});



// 5 day active strat -------------- in working progress



const sendGoalCompletionNotification = async (userId: string) => {
  const quotes = [
    'لقد وفقك الله لتعلّم القرآن… فلا تتوقف.',
    '7 أيام متواصلة مع القرآن —  ما شاء الله على هذا الخير . 🌿',
    'أحسنت! المواظبة اليومية تقرّبك من الإتقان. 📖',
    'ما شاء الله على عزيمتك — داوم بارك الله فيك. 🔄. ✨',
    'استعن بالله وداوم، أَحَبُّ الأعمالِ إلى اللهِ أدْومُها و إن قَلَّ 🤲',
  ];

  try {

    const user = await prisma.user.findUnique({
      where: { id: userId ,daailyGoalNotification:true},
      select: {
        id: true,
        fcmToken: true,
        firstName: true,
        daailyGoalNotification: true,
        WeekDay: { select: { status: true } },
      },
    });

    
    if (!user) {
      console.log(`❌ User not found: ${userId}`);
      return;
    }

    if (!user.daailyGoalNotification || !user.fcmToken) {
      console.log(`⏩ User ${user.firstName} (${user.id}) is not eligible for notification`);
      return;
    }


    const completeDays = user.WeekDay.filter(d => d.status === 'COMPLETE').length;


    const randomQuote = quotes[Math.floor(Math.random() * quotes.length)];


     await prisma.userStar.update({
        where: { userId },
        data: {
          star: {
            increment: 100,
          },
        },
      });
 

    await firebasePushNotificationServices.sendSinglePushNotification({
    
      body: { title: 'تابِع الرِّحلة 💫', body: randomQuote },
      fcmToken: user.fcmToken,
    });
    

     
    console.log(`✅ Notification sent to ${user.firstName} (${user.id})`);
  } catch (error) {
    console.error('❌ Error sending notification:', error);
  }
};

//5 day active end -------------- in working porgress





// motivational Islamic notification everyday strat------------------------------------------------------------Done
cron.schedule('0 12 * * *', async () => {

  if (globalThis.isDailyQuoteJobRunning) {
    console.log('⚠️ Cron job already running. Skipping...');
    return;
  }


  globalThis.isDailyQuoteJobRunning = true;

  try {
    

    const arabicQuotes = [
  "قال النبي ﷺ: «يُقالُ لصاحِبِ القرآنِ: اقرأْ وارتَقِ ورَتِّلْ كما كنتَ تُرتِّلُ في الدُّنيا..» 📖✨",
  "قال النبي ﷺ: «خَيْرُكُمْ مَنْ تَعَلَّمَ القُرآنَ وَعَلَّمَهُ» 🌟",
  `"‏وإن أحقَّ ما تُوهب له الأعمار كتاب الله!" 📜`,
  `قال النبي ﷺ: «الماهِرُ بالقرآنِ مع السفرةِ الكرامِ البررةِ» 🤲`,
  "وقال أحد السلف: (كلما زاد حزبي - أي: الورد اليومي - من القرآن زادت البركة في وقتي) 🌸",
  "ما زاحم القرآن شيئًا إلا باركه! ✨",
  "قال النبي ﷺ: «أحبّ الأعمال إلى الله أدومها وإن قلّ» ❤️",
  `قال ابن الجزري: " التجويد حِلْيَةُ التِّلاوَةِ * وزِينَةُ الأَدَاءِ وَالْقِرَاءَةِ".`,
  `واعلم أنك لن تتقرب الى الله بشيء هو أحب إليه من كلامه.`
    ];

    const users = await prisma.user.findMany({
      where: { daailyGoalNotification: true },
      select: { id: true, fcmToken: true },
    });

    const randomQuote =
      arabicQuotes[Math.floor(Math.random() * arabicQuotes.length)];

    for (const user of users) {
      const token = user.fcmToken;
      if (!token || token.length < 20) continue;

      try {
        await firebasePushNotificationServices.sendSinglePushNotification({
         
          body: { title: "رسالةُ اليوم 📩", body: randomQuote },
          fcmToken: token,
        });
  
      } catch (err) {
        console.error(`❌ Failed to send notification to ${user.id}:`, err);
        if (
          (err as any).message.includes('registration token is not a valid FCM registration token') ||
          (err as any).message.includes('Requested entity was not found')
        ) {
          await prisma.user.update({
            where: { id: user.id },
            data: { fcmToken: null },
          });
        }
      }
    }
  } catch (err) {
    console.error('❌ Error in cron job:', err);
  } finally {

    globalThis.isDailyQuoteJobRunning = false;
  }
});

// motivational Islamic notification everyday end -----------------------------------------------------------------Done











//  invite friend strat------------------------------------------------------- Done
cron.schedule('0 10 */3 * *', async () => {


  console.log('⏰ Running cron job (every  minute invite friend)');
  
  const messages = [
    'ادعُ صديقًا — شارك الأجر.📤🤝',
    'شارك الخير — ادعُ صديقًا لتجربة التطبيق. 🌟📤',
    'كل حرف بعشر حسنات — شارك التطبيق مع أحبّتك 📤',
    'لا تحتفظ بالخير لنفسك 🤝 شارك التطبيق مع أحبّتك. 📤',
    '🤝 أحبَّ لغيرك ما تحبه لنفسك… شارك التطبيق📤.',
  ];

  try {
    
    const users = await prisma.user.findMany({
      where: { daailyGoalNotification: true },
      select: { id: true, fcmToken: true },
    });

    if (users.length === 0) {
      console.log('🚫 No users found for notification.');
      return;
    }

 
    const randomMessage = messages[Math.floor(Math.random() * messages.length)];


for (const user of users) {
  if (user.fcmToken) {
    try {
      await firebasePushNotificationServices.sendSinglePushNotification({
   
        body: { title: 'ادعُ صديقًا 📤🤝', body: randomMessage },
        fcmToken: user.fcmToken,
      });
      console.log(`📤 Notification sent to user ${user.id}`);
    } catch (error: any) {
   
      if (error.errorInfo?.code === 'messaging/invalid-argument') {
        console.log(`⚠️ Invalid FCM token for user ${user.id}, removing...`);
        await prisma.user.update({
          where: { id: user.id },
          data: { fcmToken: null },
        });
      } else {
        console.error(`❌ Failed to send to user ${user.id}:`, error);
      }
    }
  }
}

   
  } catch (err) {
   
  }
});

// invite friend end ------------------------------------------------------ Done














// user stopped using the app strat -----------------------------------------------------in progress


cron.schedule('0 0 * * *', async () => {

  console.log('⏰ Running daily reminder cron job...');
  const arabicMessages = [
    'لا تدع العجز والكسل يغلبانك — أكمل رحلتك في طلب العلم. 🌿',
    'ما أجمل أن تعود للقرآن بعد غياب — واصل من حيث توقفت. 📖',
    'كل يوم جديد هو فرصة لتجديد العهد مع القرآن. ✨',
    'التجويد زينة التلاوة وجمال القراءة — استمر في تعلمك. 💫',
    'عُد الآن… فالقرآن سر الطمأنينة وسعادة القلب. 🤲',
  ];

  const twoDaysAgo = new Date();
  twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);


  try {
   
    const users = await prisma.user.findMany({
      where: {
        AND: [
          { readStart: { not: null } },
          { readEnd: { not: null } },
          { readEnd: { lte: twoDaysAgo } },
        ],
      },
    });

   
    const inactiveUsers = users.filter(
      user => user.readStart?.getTime() !== user.readEnd?.getTime(),
    );

   


    for (const user of inactiveUsers) {

      if(user.readStart===user.readEnd){

        continue;
      }
      const randomMessage =
        arabicMessages[Math.floor(Math.random() * arabicMessages.length)];

      const email = new Email(user);
      await email.sendCustomEmail('📖 ماذا شَغَلَك عنِ القُرآن؟', randomMessage);
      console.log("stop app using email send")
      
    }
  } catch (error) {
    console.error('❌ Error in cron job:', error);
  }
});

// user stopped using the app end------------------------------------------------------in progress









// reset week day end------------------------------- Done


cron.schedule(
  "59 23 * * 0", // ⏰ Sunday 23:59
  async () => {
    console.log("⏰ Running weekly PENDING cleanup (Morocco time)...");

    try {
      const result = await prisma.weekDay.updateMany({
        where: {
          status: "PENDING",
          active: false,
        },
        data: {
          active: true, 
        },
      });

    
    } catch (error) {
    
    }
  },
  {
    timezone: "Africa/Casablanca", // 🌍 Morocco timezone
  }
);
// reset week end ------------------------------- Done






// blockForWeek strat---------------------------------------------------------------------------------Done

cron.schedule('*/1 * * * *', async () => {
  try {
    console.log('✅ Running blockForWeek cleanup cron...');

    const users = await prisma.user.findMany({
      where: { blockForWeek: true },
      select: { id: true, blockForWeekTime: true },
    });

    const now = new Date();

    for (const user of users) {
      if (!user.blockForWeekTime) continue;

      const blockTime = new Date(user.blockForWeekTime);
      const diffMs = now.getTime() - blockTime.getTime();
      const diffDays = diffMs / (1000 * 60 * 60 * 24);

      if (diffDays >= 7) {
    
        await prisma.user.update({
          where: { id: user.id },
          data: {
            blockForWeek: false,
            blockForWeekTime: null,
          },
        });
   
      }
    }
  } catch (err) {
    console.error('❌ Error in blockForWeek cron:', err);
  }
});

// // blockForWeek end-------------------------------------------------------------------------------Done

export default app;
