import express from "express";
import { teacherLimit } from "../middlewares/auth.middleware.js";
import {
    getAnalyticsScoreTrend,
    getAnalyticsScores,
    getAnalyticsStudents,
    getAnalyticsSummary,
    getAnalyticsTopics,
} from "../controllers/analytics.controller.js";

const router = express.Router();

// Analytics endpoints only expose data for the authenticated teacher.
router.get("/summary", teacherLimit, getAnalyticsSummary);
router.get("/scores", teacherLimit, getAnalyticsScores);
router.get("/students", teacherLimit, getAnalyticsStudents);
router.get("/topics", teacherLimit, getAnalyticsTopics);
router.get("/score-trend", teacherLimit, getAnalyticsScoreTrend);

export default router;