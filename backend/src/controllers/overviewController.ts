import { Request, Response } from 'express';
import { getOverviewData, getOnlineData24h, getOnlineData7d } from '../services/overviewService';

export const getOverviewDataHandler = async (req: Request, res: Response) => {
  try {
    const data = await getOverviewData();
    
    res.status(200).json({
      success: true,
      data: data
    });
  } catch (error) {
    console.error('Error in getOverviewDataHandler:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch overview data'
    });
  }
};

export const getOnlineData24hHandler = async (req: Request, res: Response) => {
  try {
    const data = await getOnlineData24h();
    
    res.status(200).json({
      success: true,
      data: data
    });
  } catch (error) {
    console.error('Error in getOnlineData24hHandler:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch 24h online data'
    });
  }
};

export const getOnlineData7dHandler = async (req: Request, res: Response) => {
  try {
    const data = await getOnlineData7d();
    
    res.status(200).json({
      success: true,
      data: data
    });
  } catch (error) {
    console.error('Error in getOnlineData7dHandler:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch 7d online data'
    });
  }
};