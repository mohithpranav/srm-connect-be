"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.scrapeUserProfiles = scrapeUserProfiles;
// src/services/profileScraper.ts
const axios_1 = __importDefault(require("axios"));
const cheerio_1 = __importDefault(require("cheerio"));
/**
 * Scrapes GitHub and LeetCode profiles based on provided URLs
 *
 * @param {ScraperInput} input - Object containing GitHub and LeetCode URLs
 * @returns {Promise<ProfileData>} Object containing scraped data from both platforms
 * @throws {Error} If URLs are invalid or if scraping fails
 */
function scrapeUserProfiles(input) {
    return __awaiter(this, void 0, void 0, function* () {
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
        const [githubData, leetcodeData] = yield Promise.all([
            scrapeGithubData(githubUsername),
            scrapeLeetcodeData(leetcodeUsername)
        ]);
        return {
            github: githubData,
            leetcode: leetcodeData
        };
    });
}
/**
 * Extracts GitHub username from a URL
 */
function extractGithubUsername(url) {
    try {
        const parsedUrl = new URL(url);
        if (parsedUrl.hostname !== 'github.com') {
            return null;
        }
        // GitHub URLs are typically in the format: https://github.com/username
        const pathParts = parsedUrl.pathname.split('/').filter(Boolean);
        return pathParts[0] || null;
    }
    catch (e) {
        return null;
    }
}
/**
 * Extracts LeetCode username from a URL
 */
function extractLeetcodeUsername(url) {
    try {
        const parsedUrl = new URL(url);
        if (!parsedUrl.hostname.includes('leetcode.com')) {
            return null;
        }
        // LeetCode URLs are typically in the format: https://leetcode.com/username/
        const pathParts = parsedUrl.pathname.split('/').filter(Boolean);
        return pathParts[0] || null;
    }
    catch (e) {
        return null;
    }
}
/**
 * Scrapes GitHub data for a specific user
 */
function scrapeGithubData(username) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            // Use GitHub's public API to get user data
            const response = yield axios_1.default.get(`https://api.github.com/users/${username}`);
            const userData = response.data;
            // Get repositories count from the API response
            const reposResponse = yield axios_1.default.get(`https://api.github.com/users/${username}/repos?per_page=1`);
            const linkHeader = reposResponse.headers['link'];
            const repoCountMatch = linkHeader === null || linkHeader === void 0 ? void 0 : linkHeader.match(/page=(\d+)>; rel="last"/);
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
        }
        catch (error) {
            console.error('Error scraping GitHub data:', error);
            return null;
        }
    });
}
/**
 * Scrapes LeetCode data for a specific user
 */
function scrapeLeetcodeData(username) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        try {
            // Since LeetCode doesn't have a public API, we'll need to scrape the profile page
            const response = yield axios_1.default.get(`https://leetcode.com/${username}/`);
            const $ = cheerio_1.default.load(response.data);
            // Note: These selectors are hypothetical and would need to be adjusted
            // based on LeetCode's actual HTML structure
            const rankText = $('[data-cy="ranking"]').text().trim();
            const ranking = ((_a = rankText.match(/(\d+)/)) === null || _a === void 0 ? void 0 : _a[1]) || 'N/A';
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
        }
        catch (error) {
            console.error('Error scraping LeetCode data:', error);
            return null;
        }
    });
}
