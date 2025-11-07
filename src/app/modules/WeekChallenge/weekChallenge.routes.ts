import express from "express";

import auth from "../../middlewares/auth";
import { WeekChallengeController } from "./weekChallenge.controller";


const router = express.Router();



router.get("/",auth("USER"), WeekChallengeController.getAllWeek);

router.post("/calculate",auth(), WeekChallengeController.calculateDailyChallenge);




router.patch("/:id",auth("USER"), WeekChallengeController.updateWeekChallenge);



export const WeekChallengeRoutes = router;
