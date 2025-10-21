import { Request, Response } from 'express';
import { getOverviewData24h, getOverviewData7d, getOnlineData24h, getOnlineData7d } from '../services/overviewService';

export const getOverviewData24hHandler = async (req: Request, res: Response) => {
  try {
    const data = await getOverviewData24h();
    
    res.status(200).json({
      success: true,
      data: data
    });
  } catch (error) {
    console.error('Error in getOverviewData24hHandler:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch overview data for the last 24 hours'
    });
  }
};

export const getOverviewData7dHandler = async (req: Request, res: Response) => {
  try {
    const data = await getOverviewData7d();
    
    res.status(200).json({
      success: true,
      data: data
    });
  } catch (error) {
    console.error('Error in getOverviewData7dHandler:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch overview data for the last 7 days'
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