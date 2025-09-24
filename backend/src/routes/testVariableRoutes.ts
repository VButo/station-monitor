import express from 'express';
import { getTestVariableHandler, updateTestVariableHandler } from '../controllers/testVariableController';

const router = express.Router();

// GET /api/test-variable - Get current test variable value
router.get('/', getTestVariableHandler);

// PUT /api/test-variable - Update test variable value
router.put('/', updateTestVariableHandler);

export default router;