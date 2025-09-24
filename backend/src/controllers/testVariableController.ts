import { Request, Response } from 'express';
import { getTestVariable, updateTestVariable } from '../services/testVariableService';

export const getTestVariableHandler = (req: Request, res: Response): void => {
  try {
    const testValue = getTestVariable();
    res.json({ testVariable: testValue });
  } catch (error) {
    console.error('Error getting test variable:', error);
    res.status(500).json({ error: 'Failed to get test variable' });
  }
};

export const updateTestVariableHandler = (req: Request, res: Response): void => {
  try {
    const { testVariable } = req.body;
    
    if (typeof testVariable !== 'string') {
      res.status(400).json({ error: 'testVariable must be a string' });
      return;
    }
    
    const updatedValue = updateTestVariable(testVariable);
    res.json({ testVariable: updatedValue });
  } catch (error) {
    console.error('Error updating test variable:', error);
    res.status(500).json({ error: 'Failed to update test variable' });
  }
};