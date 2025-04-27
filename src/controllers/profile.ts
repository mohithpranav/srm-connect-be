import { Request, Response } from 'express';
import { scrapeUserProfiles } from '../services/profileScraper';

const profile = async (req: Request, res: Response) => {
  try {
    const { githubUrl, leetcodeUrl } = req.body;

    // Use the scraper function
    const profileData = await scrapeUserProfiles({ githubUrl, leetcodeUrl });

    res.status(200).json(profileData);
  } catch (error) {
    console.error('Error processing profile request:', error);

    if (error instanceof Error) {
      res.status(400).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Failed to fetch profile data' });
    }
  }
};

export default profile;