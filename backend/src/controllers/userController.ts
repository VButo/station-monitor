import { Request, Response } from 'express';
import { UserService } from '../services/userService';

const userService = new UserService();

export async function login(req: Request, res: Response) {
  try {
    const { email, password } = req.body;
    const session = await userService.signIn(email, password);

    const accessToken = session.session?.access_token;
    if (!accessToken) {
      return res.status(401).json({ error: 'Login failed, no access token.' });
    }

    // Set cookie to expire after 3 hours (3 * 60 * 60 * 1000 milliseconds)
    const threeHoursInMs = 1 * 60 * 60 * 1000;
    res.cookie('supabase-token', accessToken, { 
      httpOnly: true, 
      secure: false, 
      sameSite: 'lax', 
      path: '/',
      maxAge: threeHoursInMs
    });
    res.status(200).json({ message: 'Logged in' });
  } catch (error: unknown) {
    if (error instanceof Error) {
      res.status(401).json({ error: error.message });
    } else {
      res.status(401).json({ error: 'Unknown error occurred' });
    }
  }
}

export function logout(req: Request, res: Response) {
  res.clearCookie('supabase-token');
  res.status(200).json({ message: 'Logged out' });
}

export async function getCurrentUser(req: Request, res: Response) {
  try {
    const token = req.cookies['supabase-token'];
    if (!token) return res.status(401).json({ user: null });

    const user = await userService.getUser(token);
    res.json({ user });
  } catch (error: unknown) {
    if(error instanceof Error){
      res.status(401).json({error: error.message, user: null});
    } else{
      res.status(401).json({ error: 'Unknown error occurred', user: null });
    }
  }
}
