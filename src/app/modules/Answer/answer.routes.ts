import express from 'express';
import { AnswerControllers } from './answer.controller';
import validateRequest from '../../middlewares/validateRequest';
import { AnswerValidation } from './answer.validation';
import auth from '../../middlewares/auth';

const router = express.Router();


router.get(
  '/',
  auth("USER"), 
 
  AnswerControllers.myAllAnswer
);
router.get(
  '/me',
  auth("USER"), 
 
  AnswerControllers.myCorrectAnswer
);
router.get(
  '/review/me',
  auth("USER"), 
 
  AnswerControllers.myReview
);
router.post(
  '/',
  auth("USER"), 
 
  AnswerControllers.submitAnswer
);


router.post("/update", auth("USER"),AnswerControllers.submitOrUpdateAnswer);


export const AnswerRouters = router;
