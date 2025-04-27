// src/services/profileScraper.ts
import axios from 'axios';
import cheerio from 'cheerio';

// Define interfaces for our data types
interface GithubData {
  username: string;
  name: string | null;
  avatarUrl: string;
  bio: string | null;
  followers: number;
  following: number;
  repoCount: number;
  profileUrl: string;
  company: string | null;
  location: string | null;
  blog: string | null;
  createdAt: string;
}

interface LeetCodeProblemStats {
  easy: string;
  medium: string;
  hard: string;
}

interface LeetCodeData {
  username: string;
  profileUrl: string;
  ranking: string;
  problemsSolved: string;
  acceptanceRate: string;
  problems: LeetCodeProblemStats;
}

interface ProfileData {
  github: GithubData | null;
  leetcode: LeetCodeData | null;
}

interface ScraperInput {
  githubUrl: string;
  leetcodeUrl: string;
}

/**
 * Scrapes GitHub and LeetCode profiles based on provided URLs
 * 
 * @param {ScraperInput} input - Object containing GitHub and LeetCode URLs
 * @returns {Promise<ProfileData>} Object containing scraped data from both platforms
 * @throws {Error} If URLs are invalid or if scraping fails
 */
export async function scrapeUserProfiles(input: ScraperInput): Promise<ProfileData> {
  const { githubUrl, leetcodeUrl } = input;

  if (!githubUrl || !leetcodeUrl) {
    throw new Error('Both GitHub and LeetCode URLs are required');
  }

  // Extract usernames from URLs
  const githubUsername = extractGithubUsername(githubUrl);
  const leetcodeUsername = extractLeetcodeUsername(leetcodeUrl);

  if (!githubUsername || !leetcodeUsername) {
    throw new Error('Invalid URLs provided');
  }

  // Fetch data from both platforms in parallel
  const [githubData, leetcodeData] = await Promise.all([
    scrapeGithubData(githubUsername),
    scrapeLeetcodeData(leetcodeUsername)
  ]);

  return {
    github: githubData,
    leetcode: leetcodeData
  };
}

/**
 * Extracts GitHub username from a URL
 */
function extractGithubUsername(url: string): string | null {
  try {
    const parsedUrl = new URL(url);
    if (parsedUrl.hostname !== 'github.com') {
      return null;
    }
    // GitHub URLs are typically in the format: https://github.com/username
    const pathParts = parsedUrl.pathname.split('/').filter(Boolean);
    return pathParts[0] || null;
  } catch (e) {
    return null;
  }
}

/**
 * Extracts LeetCode username from a URL
 */
function extractLeetcodeUsername(url: string): string | null {
  try {
    const parsedUrl = new URL(url);
    if (!parsedUrl.hostname.includes('leetcode.com')) {
      return null;
    }
    // LeetCode URLs are typically in the format: https://leetcode.com/username/
    const pathParts = parsedUrl.pathname.split('/').filter(Boolean);
    return pathParts[0] || null;
  } catch (e) {
    return null;
  }
}

/**
 * Scrapes GitHub data for a specific user
 */
async function scrapeGithubData(username: string): Promise<GithubData | null> {
  try {
    // Use GitHub's public API to get user data
    const response = await axios.get(`https://api.github.com/users/${username}`);
    const userData = response.data;

    // Get repositories count from the API response
    const reposResponse = await axios.get(`https://api.github.com/users/${username}/repos?per_page=1`);
    const linkHeader = reposResponse.headers['link'] as string | undefined;
    const repoCountMatch = linkHeader?.match(/page=(\d+)>; rel="last"/);
    const repoCount = repoCountMatch ? parseInt(repoCountMatch[1]) : userData.public_repos;

    return {
      username: userData.login,
      name: userData.name,
      avatarUrl: userData.avatar_url,
      bio: userData.bio,
      followers: userData.followers,
      following: userData.following,
      repoCount: repoCount,
      profileUrl: userData.html_url,
      company: userData.company,
      location: userData.location,
      blog: userData.blog,
      createdAt: userData.created_at
    };
  } catch (error) {
    console.error('Error scraping GitHub data:', error);
    return null;
  }
}

/**
 * Scrapes LeetCode data for a specific user
 */
async function scrapeLeetcodeData(username: string): Promise<LeetCodeData | null> {
  try {
    // Since LeetCode doesn't have a public API, we'll need to scrape the profile page
    const response = await axios.get(`https://leetcode.com/${username}/`);
    const $ = cheerio.load(response.data);
    
    // Note: These selectors are hypothetical and would need to be adjusted
    // based on LeetCode's actual HTML structure
    const rankText = $('[data-cy="ranking"]').text().trim();
    const ranking = rankText.match(/(\d+)/)?.[1] || 'N/A';
    
    const problemsSolved = $('[data-cy="solved-count"]').text().trim() || '0';
    const acceptanceRate = $('[data-cy="acceptance-rate"]').text().trim() || 'N/A';
    
    // Extract problem solving statistics
    const easyCount = $('[data-difficulty="easy"] [data-cy="solved"]').text().trim() || '0';
    const mediumCount = $('[data-difficulty="medium"] [data-cy="solved"]').text().trim() || '0';
    const hardCount = $('[data-difficulty="hard"] [data-cy="solved"]').text().trim() || '0';
    
    return {
      username,
      profileUrl: `https://leetcode.com/${username}/`,
      ranking,
      problemsSolved,
      acceptanceRate,
      problems: {
        easy: easyCount,
        medium: mediumCount,
        hard: hardCount
      }
    };
  } catch (error) {
    console.error('Error scraping LeetCode data:', error);
    return null;
  }
}